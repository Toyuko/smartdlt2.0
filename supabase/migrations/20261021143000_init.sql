-- SmartDLT2.0 demonstration schema.
-- Appointments stored here are not official Department of Land Transport records.
-- gen_random_uuid() is provided by Postgres core. No extra extension is required.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

create table public.offices (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_th text not null,
  province text not null,
  province_th text not null,
  demo_label text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint offices_demo_label_check check (char_length(demo_label) > 0)
);

create table public.vehicle_categories (
  slug text primary key,
  name text not null,
  name_th text not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  name_th text not null,
  category text not null,
  category_th text not null,
  requires_vehicle boolean not null default false,
  document_guidance jsonb not null,
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint services_guidance_object check (jsonb_typeof(document_guidance) = 'object')
);

create table public.time_slots (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices (id),
  service_id uuid not null references public.services (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  capacity integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint time_slots_capacity_check check (capacity > 0 and capacity <= 50),
  constraint time_slots_window_check check (ends_at > starts_at)
);

create table public.staff_profiles (
  user_id uuid primary key,
  display_name text not null,
  role text not null,
  created_at timestamptz not null default now(),
  constraint staff_profiles_role_check check (role in ('staff', 'admin')),
  constraint staff_profiles_name_check check (char_length(display_name) between 2 and 80)
);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  office_id uuid not null references public.offices (id),
  service_id uuid not null references public.services (id),
  time_slot_id uuid not null references public.time_slots (id),
  vehicle_category text references public.vehicle_categories (slug),
  applicant_display_name text not null,
  contact_email text,
  contact_phone text,
  notes text,
  status text not null default 'confirmed',
  verification_token_hash text not null unique,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  checked_in_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  constraint bookings_reference_check check (reference ~ '^VD-[A-Z2-9]{4}-[A-Z2-9]{4}$'),
  constraint bookings_name_check check (char_length(applicant_display_name) between 2 and 80),
  constraint bookings_email_check check (contact_email is null or char_length(contact_email) <= 120),
  constraint bookings_phone_check check (contact_phone is null or char_length(contact_phone) <= 20),
  constraint bookings_notes_check check (notes is null or char_length(notes) <= 500),
  constraint bookings_token_hash_check check (verification_token_hash ~ '^[a-f0-9]{64}$'),
  constraint bookings_status_check check (status in ('confirmed', 'checked_in', 'completed', 'cancelled')),
  constraint bookings_status_times_check check (
    (status = 'confirmed' and checked_in_at is null and completed_at is null and cancelled_at is null)
    or (status = 'checked_in' and checked_in_at is not null and completed_at is null and cancelled_at is null)
    or (status = 'completed' and checked_in_at is not null and completed_at is not null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null and completed_at is null)
  )
);

comment on column public.bookings.verification_token_hash is
  'SHA-256 hex of the opaque demo token. The raw token is never stored.';

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  staff_user_id uuid not null references public.staff_profiles (user_id),
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint audit_logs_action_check check (action in ('check_in', 'complete', 'cancel')),
  constraint audit_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.rate_limit_buckets (
  bucket text not null,
  key_hash text not null,
  window_start timestamptz not null,
  count integer not null,
  primary key (bucket, key_hash, window_start),
  constraint rate_limit_count_check check (count >= 0)
);

create index time_slots_lookup_idx on public.time_slots (office_id, service_id, starts_at);
create index bookings_slot_status_idx on public.bookings (time_slot_id, status);
create index bookings_active_slot_idx on public.bookings (time_slot_id) where status <> 'cancelled';
create index bookings_office_created_idx on public.bookings (office_id, created_at desc);
create index bookings_service_idx on public.bookings (service_id);
create index audit_logs_booking_idx on public.audit_logs (booking_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger bookings_set_updated_at
before update on public.bookings
for each row execute function public.set_updated_at();

create or replace function public.list_slot_availability(
  p_office_id uuid,
  p_service_id uuid,
  p_from timestamptz,
  p_to timestamptz
)
returns table (
  id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  capacity integer,
  remaining integer
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ts.id,
    ts.starts_at,
    ts.ends_at,
    ts.capacity,
    greatest(
      ts.capacity - count(b.id) filter (where b.status <> 'cancelled'),
      0
    )::integer as remaining
  from public.time_slots ts
  left join public.bookings b on b.time_slot_id = ts.id
  where ts.active
    and ts.office_id = p_office_id
    and ts.service_id = p_service_id
    and ts.starts_at >= p_from
    and ts.starts_at < p_to
  group by ts.id
  order by ts.starts_at;
$$;

create or replace function public.consume_rate_limit(
  p_bucket text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_window timestamptz;
  v_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'demo_booking:rate_limit_config';
  end if;

  v_window := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  delete from public.rate_limit_buckets
  where bucket = p_bucket
    and key_hash = p_key_hash
    and window_start < v_window;

  insert into public.rate_limit_buckets as bucket_row (bucket, key_hash, window_start, count)
  values (p_bucket, p_key_hash, v_window, 1)
  on conflict (bucket, key_hash, window_start)
  do update set count = bucket_row.count + 1
  returning count into v_count;

  return v_count <= p_limit;
end;
$$;

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
  p_token_hash text
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
  v_vehicle text;
  v_active bigint;
  v_inserted public.bookings%rowtype;
begin
  select * into v_existing from public.bookings where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.office_id is distinct from p_office_id
      or v_existing.service_id is distinct from p_service_id
      or v_existing.time_slot_id is distinct from p_time_slot_id
      or v_existing.applicant_display_name is distinct from p_applicant_display_name then
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
  if not exists (select 1 from public.offices where id = p_office_id and active = true) then
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
      idempotency_key
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
      p_idempotency_key
    )
    returning * into v_inserted;
  exception
    when unique_violation then
      select * into v_existing from public.bookings where idempotency_key = p_idempotency_key;
      if found then
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

create or replace function public.transition_booking(
  p_booking_id uuid,
  p_staff_user_id uuid,
  p_action text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings%rowtype;
  v_from text;
begin
  if p_action not in ('check_in', 'complete', 'cancel') then
    raise exception 'demo_booking:invalid_transition';
  end if;

  if not exists (
    select 1 from public.staff_profiles
    where user_id = p_staff_user_id and role in ('staff', 'admin')
  ) then
    raise exception 'demo_booking:unauthorized';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'demo_booking:not_found';
  end if;

  v_from := v_booking.status;

  if p_action = 'check_in' then
    if v_booking.status = 'checked_in' then
      raise exception 'demo_booking:already_checked_in';
    end if;
    if v_booking.status <> 'confirmed' then
      raise exception 'demo_booking:invalid_transition';
    end if;
    update public.bookings
    set status = 'checked_in', checked_in_at = now()
    where id = p_booking_id
    returning * into v_booking;
  elsif p_action = 'complete' then
    if v_booking.status <> 'checked_in' then
      raise exception 'demo_booking:invalid_transition';
    end if;
    update public.bookings
    set status = 'completed', completed_at = now()
    where id = p_booking_id
    returning * into v_booking;
  else
    if v_booking.status not in ('confirmed', 'checked_in') then
      raise exception 'demo_booking:invalid_transition';
    end if;
    update public.bookings
    set status = 'cancelled', cancelled_at = now()
    where id = p_booking_id
    returning * into v_booking;
  end if;

  insert into public.audit_logs (booking_id, staff_user_id, action, metadata)
  values (
    p_booking_id,
    p_staff_user_id,
    p_action,
    jsonb_build_object('from', v_from, 'to', v_booking.status)
  );

  return jsonb_build_object(
    'id', v_booking.id,
    'reference', v_booking.reference,
    'status', v_booking.status,
    'checked_in_at', v_booking.checked_in_at,
    'completed_at', v_booking.completed_at,
    'cancelled_at', v_booking.cancelled_at
  );
end;
$$;

create or replace function public.staff_dashboard_counts(p_staff_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_today_start timestamptz;
  v_week_start timestamptz;
begin
  if not exists (
    select 1 from public.staff_profiles
    where user_id = p_staff_user_id and role in ('staff', 'admin')
  ) then
    raise exception 'demo_booking:unauthorized';
  end if;

  v_today_start := date_trunc('day', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';
  v_week_start := date_trunc('week', now() at time zone 'Asia/Bangkok') at time zone 'Asia/Bangkok';

  return jsonb_build_object(
    'today', (
      select count(*) from public.bookings b
      join public.time_slots t on t.id = b.time_slot_id
      where t.starts_at >= v_today_start
        and t.starts_at < v_today_start + interval '1 day'
        and b.status <> 'cancelled'
    ),
    'week', (
      select count(*) from public.bookings b
      join public.time_slots t on t.id = b.time_slot_id
      where t.starts_at >= v_week_start
        and t.starts_at < v_week_start + interval '7 days'
        and b.status <> 'cancelled'
    ),
    'upcoming', (
      select count(*) from public.bookings b
      join public.time_slots t on t.id = b.time_slot_id
      where t.starts_at >= now() and b.status = 'confirmed'
    ),
    'cancelled', (select count(*) from public.bookings where status = 'cancelled'),
    'checked_in', (select count(*) from public.bookings where status = 'checked_in'),
    'completed', (select count(*) from public.bookings where status = 'completed')
  );
end;
$$;

revoke all on function public.set_updated_at() from public;
revoke all on function public.consume_rate_limit(text, text, integer, integer) from public;
revoke all on function public.reserve_demo_booking(uuid, uuid, uuid, text, text, text, text, text, text, text, text) from public;
revoke all on function public.transition_booking(uuid, uuid, text) from public;
revoke all on function public.staff_dashboard_counts(uuid) from public;
revoke all on function public.list_slot_availability(uuid, uuid, timestamptz, timestamptz) from public;

grant execute on function public.list_slot_availability(uuid, uuid, timestamptz, timestamptz) to anon, authenticated, service_role;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.reserve_demo_booking(uuid, uuid, uuid, text, text, text, text, text, text, text, text) to service_role;
grant execute on function public.transition_booking(uuid, uuid, text) to service_role;
grant execute on function public.staff_dashboard_counts(uuid) to service_role;

grant select on public.offices, public.services, public.vehicle_categories, public.time_slots to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to service_role;

revoke all on public.bookings from public, anon, authenticated;
revoke all on public.audit_logs from public, anon, authenticated;
revoke all on public.staff_profiles from public, anon, authenticated;
revoke all on public.rate_limit_buckets from public, anon, authenticated;

alter table public.offices enable row level security;
alter table public.services enable row level security;
alter table public.vehicle_categories enable row level security;
alter table public.time_slots enable row level security;
alter table public.bookings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.staff_profiles enable row level security;
alter table public.rate_limit_buckets enable row level security;

create policy offices_public_read on public.offices
  for select to anon, authenticated
  using (active = true);

create policy services_public_read on public.services
  for select to anon, authenticated
  using (active = true);

create policy vehicle_categories_public_read on public.vehicle_categories
  for select to anon, authenticated
  using (active = true);

create policy time_slots_public_read on public.time_slots
  for select to anon, authenticated
  using (active = true);
