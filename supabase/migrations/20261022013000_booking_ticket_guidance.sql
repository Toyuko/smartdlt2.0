-- Stores the sample checklist chosen when a demo booking is created.
-- The raw QR token stays a SHA-256 hash. This column is not an official requirement list.

alter table public.bookings
  add column if not exists document_guidance jsonb not null default '{}'::jsonb;

alter table public.bookings drop constraint if exists bookings_document_guidance_object;
alter table public.bookings
  add constraint bookings_document_guidance_object
  check (jsonb_typeof(document_guidance) = 'object');

comment on column public.bookings.document_guidance is
  'Snapshot of the sample checklist for this demo booking. Not an official requirement list.';

drop function if exists public.reserve_demo_booking(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb);

create or replace function public.reserve_demo_booking(
  p_office_id uuid,
  p_service_id uuid,
  p_time_slot_id uuid,
  p_vehicle_category text,
  p_applicant_display_name text,
  p_contact_email text,
  p_contact_phone text,
  p_notes text,
  p_idempotency_key text,
  p_reference text,
  p_token_hash text,
  p_applicant_category text default null,
  p_answers jsonb default '{}'::jsonb,
  p_document_guidance jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.bookings%rowtype;
  v_slot public.time_slots%rowtype;
  v_service public.services%rowtype;
  v_office public.offices%rowtype;
  v_category public.booking_categories%rowtype;
  v_vehicle text;
  v_active bigint;
  v_inserted public.bookings%rowtype;
  v_today date;
  v_expiry date;
  v_days integer;
  v_window jsonb;
  v_answers jsonb;
begin
  if p_answers is null or jsonb_typeof(p_answers) <> 'object' then
    raise exception 'demo_booking:validation';
  end if;
  if char_length(p_answers::text) > 4000 or p_answers::text ~ '[0-9]{9,}' then
    raise exception 'demo_booking:validation';
  end if;
  if p_document_guidance is null or jsonb_typeof(p_document_guidance) <> 'object' then
    raise exception 'demo_booking:validation';
  end if;
  if char_length(p_document_guidance::text) > 12000 or p_document_guidance::text ~ '[0-9]{9,}' then
    raise exception 'demo_booking:validation';
  end if;
  if p_applicant_category is not null and p_applicant_category not in ('thai', 'foreign') then
    raise exception 'demo_booking:validation';
  end if;
  v_answers := p_answers;

  select * into v_existing from public.bookings where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.office_id is distinct from p_office_id
      or v_existing.service_id is distinct from p_service_id
      or v_existing.time_slot_id is distinct from p_time_slot_id
      or v_existing.applicant_display_name is distinct from p_applicant_display_name
      or v_existing.applicant_category is distinct from p_applicant_category
      or v_existing.answers is distinct from v_answers then
      raise exception 'demo_booking:idempotency_conflict';
    end if;
    return jsonb_build_object(
      'idempotent', true,
      'id', v_existing.id,
      'reference', v_existing.reference,
      'status', v_existing.status
    );
  end if;

  select * into v_slot from public.time_slots where id = p_time_slot_id for update;
  if not found or not v_slot.active then
    raise exception 'demo_booking:slot_unavailable';
  end if;
  if v_slot.office_id is distinct from p_office_id or v_slot.service_id is distinct from p_service_id then
    raise exception 'demo_booking:slot_unavailable';
  end if;
  if v_slot.starts_at <= now() then
    raise exception 'demo_booking:slot_past';
  end if;

  select * into v_service from public.services where id = p_service_id and active = true;
  if not found then
    raise exception 'demo_booking:slot_unavailable';
  end if;
  select * into v_office from public.offices where id = p_office_id and active = true;
  if not found then
    raise exception 'demo_booking:slot_unavailable';
  end if;

  v_vehicle := p_vehicle_category;
  if v_service.requires_vehicle then
    if v_vehicle is null or not exists (
      select 1 from public.vehicle_categories where slug = v_vehicle and active = true
    ) then
      raise exception 'demo_booking:vehicle_required';
    end if;
  else
    v_vehicle := null;
  end if;

  select * into v_category from public.booking_categories where slug = v_service.category;
  if found then
    if not v_category.active then
      raise exception 'demo_booking:slot_unavailable';
    end if;
    if cardinality(v_category.eligible_office_slugs) > 0
      and not (v_office.slug = any (v_category.eligible_office_slugs)) then
      raise exception 'demo_booking:slot_unavailable';
    end if;
    v_today := (timezone('Asia/Bangkok', now()))::date;
    if v_category.slot_rules ? 'horizonDays' then
      if (timezone('Asia/Bangkok', v_slot.starts_at))::date
        > v_today + (v_category.slot_rules->>'horizonDays')::integer then
        raise exception 'demo_booking:slot_unavailable';
      end if;
    end if;
    if v_category.slot_rules ? 'renewal' then
      if coalesce(v_answers->>'currentLicenceType', '') = ''
        or coalesce(v_answers->>'expiryDate', '') !~ '^\d{4}-\d{2}-\d{2}$' then
        raise exception 'demo_booking:validation';
      end if;
      v_window := v_category.slot_rules->'renewal'->(v_answers->>'currentLicenceType');
      if v_window is null then
        raise exception 'demo_booking:validation';
      end if;
      begin
        v_expiry := (v_answers->>'expiryDate')::date;
      exception
        when others then
          raise exception 'demo_booking:validation';
      end;
      v_days := v_expiry - v_today;
      if v_days > coalesce((v_window->>'maxDaysBeforeExpiry')::integer, 0)
        or v_days < -coalesce((v_window->>'maxDaysAfterExpiry')::integer, 0) then
        raise exception 'demo_booking:renewal_window';
      end if;
    end if;
  end if;

  select count(*) into v_active
  from public.bookings
  where time_slot_id = p_time_slot_id
    and status <> 'cancelled';

  if v_active >= v_slot.capacity then
    raise exception 'demo_booking:slot_full';
  end if;

  begin
    insert into public.bookings (
      reference,
      office_id,
      service_id,
      time_slot_id,
      vehicle_category,
      applicant_display_name,
      contact_email,
      contact_phone,
      notes,
      status,
      verification_token_hash,
      idempotency_key,
      applicant_category,
      answers,
      document_guidance
    ) values (
      p_reference,
      p_office_id,
      p_service_id,
      p_time_slot_id,
      v_vehicle,
      p_applicant_display_name,
      p_contact_email,
      p_contact_phone,
      p_notes,
      'confirmed',
      p_token_hash,
      p_idempotency_key,
      p_applicant_category,
      v_answers,
      p_document_guidance
    )
    returning * into v_inserted;
  exception
    when unique_violation then
      select * into v_existing from public.bookings where idempotency_key = p_idempotency_key;
      if found then
        if v_existing.office_id is distinct from p_office_id
          or v_existing.service_id is distinct from p_service_id
          or v_existing.time_slot_id is distinct from p_time_slot_id
          or v_existing.applicant_display_name is distinct from p_applicant_display_name
          or v_existing.applicant_category is distinct from p_applicant_category
          or v_existing.answers is distinct from v_answers then
          raise exception 'demo_booking:idempotency_conflict';
        end if;
        return jsonb_build_object(
          'idempotent', true,
          'id', v_existing.id,
          'reference', v_existing.reference,
          'status', v_existing.status
        );
      end if;
      raise exception 'demo_booking:reference_conflict';
  end;

  return jsonb_build_object(
    'idempotent', false,
    'id', v_inserted.id,
    'reference', v_inserted.reference,
    'status', v_inserted.status
  );
end;
$$;

revoke all on function public.reserve_demo_booking(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb, jsonb) from public;
grant execute on function public.reserve_demo_booking(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb, jsonb) to service_role;
