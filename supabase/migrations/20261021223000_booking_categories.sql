-- Extends the demonstration booking desk with configurable categories.
-- Existing bookings keep their rows. New columns are nullable or defaulted.

create table if not exists public.booking_categories (
  slug text primary key,
  name text not null,
  name_th text not null,
  description text not null,
  description_th text not null,
  icon text not null,
  active boolean not null default true,
  sort_order integer not null default 0,
  conditional_fields jsonb not null,
  document_sets jsonb not null,
  eligible_office_slugs text[] not null,
  vehicle_slugs text[] not null default '{}',
  slot_rules jsonb not null,
  created_at timestamptz not null default now(),
  constraint booking_categories_fields_array check (jsonb_typeof(conditional_fields) = 'array'),
  constraint booking_categories_documents_array check (jsonb_typeof(document_sets) = 'array'),
  constraint booking_categories_rules_object check (jsonb_typeof(slot_rules) = 'object')
);

comment on table public.booking_categories is
  'Configurable demonstration booking categories. Not an official DLT catalogue.';

alter table public.bookings
  add column if not exists applicant_category text,
  add column if not exists answers jsonb not null default '{}'::jsonb;

alter table public.bookings drop constraint if exists bookings_applicant_category_check;
alter table public.bookings
  add constraint bookings_applicant_category_check
  check (applicant_category is null or applicant_category in ('thai', 'foreign'));

alter table public.bookings drop constraint if exists bookings_answers_object;
alter table public.bookings
  add constraint bookings_answers_object
  check (jsonb_typeof(answers) = 'object');

comment on column public.bookings.answers is
  'Category answers for the demo. Do not store identity, passport, or licence numbers.';

drop function if exists public.reserve_demo_booking(uuid, uuid, uuid, text, text, text, text, text, text, text, text);

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
  p_answers jsonb default '{}'::jsonb
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
      answers
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
      v_answers
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

revoke all on function public.reserve_demo_booking(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.reserve_demo_booking(uuid, uuid, uuid, text, text, text, text, text, text, text, text, text, jsonb) to service_role;

revoke all on public.booking_categories from public, anon, authenticated;
grant select on public.booking_categories to anon, authenticated;
grant select, insert, update, delete on public.booking_categories to service_role;

alter table public.booking_categories enable row level security;

drop policy if exists booking_categories_public_read on public.booking_categories;
create policy booking_categories_public_read on public.booking_categories
  for select to anon, authenticated
  using (active = true);
insert into public.booking_categories (
  slug, name, name_th, description, description_th, icon, active, sort_order,
  conditional_fields, document_sets, eligible_office_slugs, vehicle_slugs, slot_rules
) values (
  'new-thai-licence', 'New Thai Driving Licence', 'ใบอนุญาตขับขี่ไทยใหม่', 'First-time demonstration for a car or motorcycle licence. Thai and foreign applicant paths use different sample checklists.', 'สาธิตคำขอครั้งแรกสำหรับรถยนต์หรือรถจักรยานยนต์ เส้นทางผู้ขอไทยและต่างชาติใช้รายการตัวอย่างคนละชุด', 'card', true, 1,
  $cfg$[]$cfg$::jsonb, $cfg$[{"id":"new-thai-car","titleEn":"Sample checklist — Thai applicant, car","titleTh":"รายการตัวอย่าง — ผู้ขอไทย รถยนต์","when":{"applicantCategories":["thai"],"licenceClasses":["car"]},"items":[{"kind":"original","en":"Use the synthetic display name from this booking. Do not bring or type a national ID number.","th":"ใช้ชื่อสมมติจากรายการจองนี้ อย่านำหรือพิมพ์เลขประจำตัวประชาชน"},{"kind":"example","en":"A training-certificate example is described here only. This demo does not collect or upload it.","th":"ตัวอย่างใบผ่านการอบรมเป็นคำอธิบายเท่านั้น ระบบสาธิตนี้ไม่เก็บและไม่ให้อัปโหลด"},{"kind":"copy","en":"Print or save this demonstration confirmation.","th":"พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"}]},{"id":"new-thai-motorcycle","titleEn":"Sample checklist — Thai applicant, motorcycle","titleTh":"รายการตัวอย่าง — ผู้ขอไทย รถจักรยานยนต์","when":{"applicantCategories":["thai"],"licenceClasses":["motorcycle"]},"items":[{"kind":"original","en":"Use the synthetic display name from this booking.","th":"ใช้ชื่อสมมติจากรายการจองนี้"},{"kind":"example","en":"Motorcycle training is a sample topic only. Nothing is uploaded here.","th":"การอบรมรถจักรยานยนต์เป็นหัวข้อตัวอย่างเท่านั้น ไม่มีการอัปโหลด"},{"kind":"copy","en":"Print or save this demonstration confirmation.","th":"พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"}]},{"id":"new-foreign","titleEn":"Sample checklist — foreign applicant","titleTh":"รายการตัวอย่าง — ผู้ขอต่างชาติ","when":{"applicantCategories":["foreign"]},"items":[{"kind":"example","en":"A stay-permission example may be discussed at a real office. Do not upload a passport, visa, or immigration document here.","th":"ตัวอย่างเอกสารการพำนักอาจถูกพูดถึงที่สำนักงานจริง อย่าอัปโหลดหนังสือเดินทาง วีซ่า หรือเอกสารตรวจคนเข้าเมืองที่นี่"},{"kind":"original","en":"Use a synthetic display name only.","th":"ใช้เฉพาะชื่อสมมติ"},{"kind":"copy","en":"Print or save this demonstration confirmation.","th":"พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"}]},{"id":"new-general","titleEn":"Sample checklist — new Thai licence","titleTh":"รายการตัวอย่าง — ใบอนุญาตไทยใหม่","items":[{"kind":"example","en":"Choose the applicant path and licence class to see one matching checklist.","th":"เลือกประเภทผู้ขอและชั้นใบอนุญาตเพื่อดูรายการที่ตรงกันหนึ่งชุด"},{"kind":"copy","en":"Print or save this demonstration confirmation.","th":"พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"}]}]$cfg$::jsonb, array['riverside', 'canal', 'coastal', 'campus']::text[], array['car', 'motorcycle']::text[], $cfg${"timezone":"Asia/Bangkok","horizonDays":21}$cfg$::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  description = excluded.description,
  description_th = excluded.description_th,
  icon = excluded.icon,
  active = excluded.active,
  sort_order = excluded.sort_order,
  conditional_fields = excluded.conditional_fields,
  document_sets = excluded.document_sets,
  eligible_office_slugs = excluded.eligible_office_slugs,
  vehicle_slugs = excluded.vehicle_slugs,
  slot_rules = excluded.slot_rules;

insert into public.booking_categories (
  slug, name, name_th, description, description_th, icon, active, sort_order,
  conditional_fields, document_sets, eligible_office_slugs, vehicle_slugs, slot_rules
) values (
  'foreign-conversion', 'Foreign Licence Conversion', 'แปลงใบอนุญาตต่างประเทศ', 'Practise converting a foreign licence. These answers do not decide legal eligibility.', 'ฝึกขั้นตอนแปลงใบอนุญาตต่างประเทศ คำตอบเหล่านี้ไม่ได้ตัดสินสิทธิ์ทางกฎหมาย', 'globe', true, 2,
  $cfg$[{"key":"issuingCountry","labelEn":"Country that issued the existing licence","labelTh":"ประเทศที่ออกใบอนุญาตเดิม","helpEn":"Choose a sample country. This does not mean the applicant is legally eligible.","helpTh":"เลือกประเทศตัวอย่าง ไม่ได้หมายความว่าผู้ขอมีสิทธิ์ตามกฎหมาย","kind":"select","required":true,"options":[{"value":"japan","labelEn":"Japan","labelTh":"ญี่ปุ่น","active":true},{"value":"united-kingdom","labelEn":"United Kingdom","labelTh":"สหราชอาณาจักร","active":true},{"value":"germany","labelEn":"Germany","labelTh":"เยอรมนี","active":true},{"value":"france","labelEn":"France","labelTh":"ฝรั่งเศส","active":true},{"value":"australia","labelEn":"Australia","labelTh":"ออสเตรเลีย","active":true},{"value":"united-states","labelEn":"United States","labelTh":"สหรัฐอเมริกา","active":true},{"value":"south-korea","labelEn":"South Korea","labelTh":"เกาหลีใต้","active":true},{"value":"other-demo","labelEn":"Other demonstration country","labelTh":"ประเทศตัวอย่างอื่น","active":true}]},{"key":"foreignLicenceClass","labelEn":"Existing licence covers","labelTh":"ใบอนุญาตเดิมครอบคลุม","kind":"select","required":true,"options":[{"value":"car","labelEn":"Car","labelTh":"รถยนต์","active":true},{"value":"motorcycle","labelEn":"Motorcycle","labelTh":"รถจักรยานยนต์","active":true},{"value":"both","labelEn":"Car and motorcycle","labelTh":"รถยนต์และรถจักรยานยนต์","active":true}]},{"key":"foreignValid","labelEn":"Licence validity in this demo","labelTh":"สถานะอายุใบอนุญาตในระบบสาธิต","helpEn":"A sample status only. It is not a legal finding.","helpTh":"เป็นสถานะตัวอย่างเท่านั้น ไม่ใช่ข้อสรุปทางกฎหมาย","kind":"select","required":true,"options":[{"value":"valid","labelEn":"Currently valid","labelTh":"ยังไม่หมดอายุ","active":true},{"value":"expired","labelEn":"Expired","labelTh":"หมดอายุแล้ว","active":true},{"value":"unsure","labelEn":"Not sure","labelTh":"ไม่แน่ใจ","active":true}]},{"key":"foreignLanguage","labelEn":"Language of the existing licence","labelTh":"ภาษาของใบอนุญาตเดิม","kind":"select","required":true,"options":[{"value":"english","labelEn":"English","labelTh":"อังกฤษ","active":true},{"value":"thai","labelEn":"Thai","labelTh":"ไทย","active":true},{"value":"other","labelEn":"Another language","labelTh":"ภาษาอื่น","active":true}]}]$cfg$::jsonb, $cfg$[{"id":"conversion-translation","titleEn":"Sample checklist — translation and foreign licence","titleTh":"รายการตัวอย่าง — คำแปลและใบอนุญาตต่างประเทศ","when":{"licenceClasses":["car","motorcycle","both"]},"items":[{"kind":"original","en":"The foreign licence you already hold may be discussed. Do not type its number.","th":"อาจพูดถึงใบอนุญาตต่างประเทศที่ถืออยู่ อย่าพิมพ์เลขใบอนุญาต"},{"kind":"example","en":"If the licence is not in Thai or English, a translation is a sample requirement. This demo does not accept an upload.","th":"หากใบอนุญาตไม่ใช่ภาษาไทยหรืออังกฤษ คำแปลเป็นข้อกำหนดตัวอย่าง ระบบสาธิตนี้ไม่รับไฟล์อัปโหลด","validityEn":"Demo note only — confirm any translation period through official instructions.","validityTh":"เป็นบันทึกสาธิตเท่านั้น โปรดตรวจระยะเวลาของคำแปลจากคำแนะนำทางการ"},{"kind":"copy","en":"Print or save this demonstration confirmation.","th":"พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"}]},{"id":"conversion-general","titleEn":"Sample checklist — foreign licence conversion","titleTh":"รายการตัวอย่าง — แปลงใบอนุญาตต่างประเทศ","items":[{"kind":"example","en":"Answer the sample questions to see the translation note that matches the licence class.","th":"ตอบคำถามตัวอย่างเพื่อดูบันทึกคำแปลที่ตรงกับชั้นใบอนุญาต"},{"kind":"copy","en":"Print or save this demonstration confirmation.","th":"พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"}]}]$cfg$::jsonb, array['riverside', 'canal', 'coastal', 'campus']::text[], array[]::text[], $cfg${"timezone":"Asia/Bangkok","horizonDays":21}$cfg$::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  description = excluded.description,
  description_th = excluded.description_th,
  icon = excluded.icon,
  active = excluded.active,
  sort_order = excluded.sort_order,
  conditional_fields = excluded.conditional_fields,
  document_sets = excluded.document_sets,
  eligible_office_slugs = excluded.eligible_office_slugs,
  vehicle_slugs = excluded.vehicle_slugs,
  slot_rules = excluded.slot_rules;

insert into public.booking_categories (
  slug, name, name_th, description, description_th, icon, active, sort_order,
  conditional_fields, document_sets, eligible_office_slugs, vehicle_slugs, slot_rules
) values (
  'thai-renewal', 'Thai Driving Licence Renewal', 'ต่ออายุใบอนุญาตขับขี่ไทย', 'Renew a sample Thai licence. The date window below is a configurable demo rule, not a legal determination.', 'ต่ออายุใบอนุญาตไทยตัวอย่าง ช่วงวันที่ด้านล่างเป็นกฎสาธิตที่ปรับได้ ไม่ใช่ข้อกำหนดทางกฎหมาย', 'refresh', true, 3,
  $cfg$[{"key":"currentLicenceType","labelEn":"Current licence type","labelTh":"ประเภทใบอนุญาตปัจจุบัน","helpEn":"Temporary and five-year are the options enabled for this demo.","helpTh":"ชั่วคราวและห้าปีเป็นตัวเลือกที่เปิดใช้ในระบบสาธิตนี้","kind":"select","required":true,"options":[{"value":"temporary","labelEn":"Temporary","labelTh":"ชั่วคราว","active":true},{"value":"five_year","labelEn":"Five-year","labelTh":"ห้าปี","active":true},{"value":"lifetime","labelEn":"Lifetime","labelTh":"ตลอดชีพ","active":false}]},{"key":"expiryDate","labelEn":"Current expiry date","labelTh":"วันหมดอายุปัจจุบัน","helpEn":"Use a date. If it sits outside the configured demo window, you can read the warning but not pick a slot.","helpTh":"ใส่วันที่ หากอยู่นอกช่วงสาธิตที่ตั้งไว้ จะเห็นคำเตือนและเลือกช่วงเวลาไม่ได้","kind":"date","required":true}]$cfg$::jsonb, $cfg$[{"id":"renewal-temporary","titleEn":"Sample checklist — temporary licence","titleTh":"รายการตัวอย่าง — ใบอนุญาตชั่วคราว","when":{"licenceTypes":["temporary"]},"items":[{"kind":"original","en":"The current temporary licence may be shown at a real counter. Do not type its number.","th":"ใบอนุญาตชั่วคราวปัจจุบันอาจต้องแสดงที่เคาน์เตอร์จริง อย่าพิมพ์เลขใบอนุญาต","validityEn":"Demo window for a temporary licence: expiry within the configured number of days.","validityTh":"ช่วงสาธิตของใบชั่วคราว: วันหมดอายุอยู่ในจำนวนวันที่ตั้งไว้"},{"kind":"copy","en":"Print or save this demonstration confirmation.","th":"พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"}]},{"id":"renewal-five-year","titleEn":"Sample checklist — five-year licence","titleTh":"รายการตัวอย่าง — ใบอนุญาตห้าปี","when":{"licenceTypes":["five_year"]},"items":[{"kind":"original","en":"The current five-year licence may be shown at a real counter. Do not type its number.","th":"ใบอนุญาตห้าปีปัจจุบันอาจต้องแสดงที่เคาน์เตอร์จริง อย่าพิมพ์เลขใบอนุญาต","validityEn":"Demo window for a five-year licence: inside the configured before-and-after expiry days.","validityTh":"ช่วงสาธิตของใบห้าปี: อยู่ในจำนวนวันก่อนและหลังหมดอายุที่ตั้งไว้"},{"kind":"copy","en":"Print or save this demonstration confirmation.","th":"พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"}]},{"id":"renewal-general","titleEn":"Sample checklist — Thai licence renewal","titleTh":"รายการตัวอย่าง — ต่ออายุใบอนุญาตไทย","items":[{"kind":"example","en":"Choose temporary or five-year to see that checklist. Lifetime is turned off in this demo.","th":"เลือกชั่วคราวหรือห้าปีเพื่อดูรายการนั้น ตัวเลือกตลอดชีพถูกปิดในระบบสาธิตนี้"},{"kind":"copy","en":"Print or save this demonstration confirmation.","th":"พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"}]}]$cfg$::jsonb, array['riverside', 'canal', 'coastal', 'campus']::text[], array['car', 'motorcycle']::text[], $cfg${"timezone":"Asia/Bangkok","horizonDays":21,"renewal":{"temporary":{"maxDaysBeforeExpiry":60,"maxDaysAfterExpiry":0},"five_year":{"maxDaysBeforeExpiry":90,"maxDaysAfterExpiry":365}}}$cfg$::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  description = excluded.description,
  description_th = excluded.description_th,
  icon = excluded.icon,
  active = excluded.active,
  sort_order = excluded.sort_order,
  conditional_fields = excluded.conditional_fields,
  document_sets = excluded.document_sets,
  eligible_office_slugs = excluded.eligible_office_slugs,
  vehicle_slugs = excluded.vehicle_slugs,
  slot_rules = excluded.slot_rules;

insert into public.booking_categories (
  slug, name, name_th, description, description_th, icon, active, sort_order,
  conditional_fields, document_sets, eligible_office_slugs, vehicle_slugs, slot_rules
) values (
  'change-or-replace', 'Change or Replace a Licence', 'เปลี่ยนหรือออกใบแทน', 'Change the licence type, replace a lost or damaged card, or update sample details. Individual services can be switched off.', 'เปลี่ยนประเภทใบอนุญาต ออกใบแทนกรณีสูญหายหรือชำรุด หรือแก้รายละเอียดตัวอย่าง สามารถปิดบริการย่อยได้', 'replace', true, 4,
  $cfg$[{"key":"replacementReason","labelEn":"What happened to the licence","labelTh":"เกิดอะไรขึ้นกับใบอนุญาต","kind":"select","required":true,"showWhen":{"serviceSlugs":["replace-card"]},"options":[{"value":"lost","labelEn":"Lost","labelTh":"สูญหาย","active":true},{"value":"damaged","labelEn":"Damaged","labelTh":"ชำรุด","active":true}]},{"key":"detailToUpdate","labelEn":"What should the demo record","labelTh":"ให้ระบบสาธิตบันทึกอะไร","helpEn":"Only a synthetic display-name note is available. Do not enter an identity number.","helpTh":"มีเพียงบันทึกชื่อสมมติ อย่ากรอกเลขประจำตัว","kind":"select","required":true,"showWhen":{"serviceSlugs":["update-details"]},"options":[{"value":"display-name","labelEn":"Display name spelling","labelTh":"การสะกดชื่อที่แสดง","active":true}]}]$cfg$::jsonb, $cfg$[{"id":"change-type","titleEn":"Sample checklist — change licence type","titleTh":"รายการตัวอย่าง — เปลี่ยนประเภทใบอนุญาต","when":{"serviceSlugs":["change-type"]},"items":[{"kind":"example","en":"The vehicle category you choose is the sample target class.","th":"หมวดยานพาหนะที่เลือกคือชั้นเป้าหมายตัวอย่าง"},{"kind":"copy","en":"Print or save this demonstration confirmation.","th":"พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"}]},{"id":"replace-card","titleEn":"Sample checklist — replace a lost or damaged licence","titleTh":"รายการตัวอย่าง — ออกใบแทนกรณีสูญหายหรือชำรุด","when":{"serviceSlugs":["replace-card"]},"items":[{"kind":"example","en":"A loss report is a real-world topic. This demo does not collect a report or a licence number.","th":"ใบแจ้งความเป็นเรื่องของโลกจริง ระบบสาธิตนี้ไม่เก็บใบแจ้งความหรือเลขใบอนุญาต"},{"kind":"copy","en":"Print or save this demonstration confirmation.","th":"พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"}]},{"id":"update-details","titleEn":"Sample checklist — update details","titleTh":"รายการตัวอย่าง — แก้รายละเอียด","when":{"serviceSlugs":["update-details"]},"items":[{"kind":"example","en":"Bring only the synthetic display name. Do not write an identity number in the notes.","th":"นำเฉพาะชื่อสมมติ อย่าเขียนเลขประจำตัวในบันทึก"},{"kind":"copy","en":"Print or save this demonstration confirmation.","th":"พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"}]},{"id":"change-general","titleEn":"Sample checklist — change or replace","titleTh":"รายการตัวอย่าง — เปลี่ยนหรือออกใบแทน","items":[{"kind":"example","en":"Pick a reason to see the checklist for that reason only.","th":"เลือกเหตุผลเพื่อดูรายการของเหตุผลนั้นเท่านั้น"}]}]$cfg$::jsonb, array['riverside', 'canal', 'coastal', 'campus']::text[], array['car', 'motorcycle']::text[], $cfg${"timezone":"Asia/Bangkok","horizonDays":21}$cfg$::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  description = excluded.description,
  description_th = excluded.description_th,
  icon = excluded.icon,
  active = excluded.active,
  sort_order = excluded.sort_order,
  conditional_fields = excluded.conditional_fields,
  document_sets = excluded.document_sets,
  eligible_office_slugs = excluded.eligible_office_slugs,
  vehicle_slugs = excluded.vehicle_slugs,
  slot_rules = excluded.slot_rules;

insert into public.booking_categories (
  slug, name, name_th, description, description_th, icon, active, sort_order,
  conditional_fields, document_sets, eligible_office_slugs, vehicle_slugs, slot_rules
) values (
  'international-permit', 'International Driving Permit', 'ใบอนุญาตขับขี่ระหว่างประเทศ', 'A sample permit visit with one checklist and a vehicle category. Offered at selected demo offices only.', 'การติดต่อตัวอย่างสำหรับใบอนุญาตระหว่างประเทศ มีรายการเดียวและหมวดยานพาหนะ เปิดเฉพาะบางสำนักงานสาธิต', 'permit', true, 5,
  $cfg$[]$cfg$::jsonb, $cfg$[{"id":"idp-checklist","titleEn":"Sample checklist — international driving permit","titleTh":"รายการตัวอย่าง — ใบอนุญาตขับขี่ระหว่างประเทศ","items":[{"kind":"example","en":"A current Thai licence is a real-world topic. This demo does not collect the licence number.","th":"ใบอนุญาตไทยที่ยังใช้ได้เป็นเรื่องของโลกจริง ระบบสาธิตนี้ไม่เก็บเลขใบอนุญาต"},{"kind":"original","en":"Photos are not uploaded in this demonstration.","th":"ระบบสาธิตนี้ไม่ให้อัปโหลดรูป"},{"kind":"copy","en":"Print or save this demonstration confirmation.","th":"พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้","validityEn":"Sample note: one confirmation is enough for the demo desk.","validityTh":"บันทึกตัวอย่าง: ใบยืนยันใบเดียวพอสำหรับโต๊ะสาธิต"}]}]$cfg$::jsonb, array['riverside', 'canal']::text[], array['car', 'motorcycle']::text[], $cfg${"timezone":"Asia/Bangkok","horizonDays":21}$cfg$::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  description = excluded.description,
  description_th = excluded.description_th,
  icon = excluded.icon,
  active = excluded.active,
  sort_order = excluded.sort_order,
  conditional_fields = excluded.conditional_fields,
  document_sets = excluded.document_sets,
  eligible_office_slugs = excluded.eligible_office_slugs,
  vehicle_slugs = excluded.vehicle_slugs,
  slot_rules = excluded.slot_rules;

insert into public.booking_categories (
  slug, name, name_th, description, description_th, icon, active, sort_order,
  conditional_fields, document_sets, eligible_office_slugs, vehicle_slugs, slot_rules
) values (
  'other-demo', 'Other Demonstration Services', 'บริการสาธิตอื่น', 'Extra services configured for this desk. Not every transport-office transaction can be reserved here.', 'บริการเพิ่มที่ตั้งค่าไว้สำหรับโต๊ะนี้ ไม่ใช่ทุกธุรกรรมของสำนักงานขนส่งจะจองผ่านขั้นตอนนี้ได้', 'more', true, 6,
  $cfg$[]$cfg$::jsonb, $cfg$[{"id":"other-checklist","titleEn":"Sample checklist — other demonstration services","titleTh":"รายการตัวอย่าง — บริการสาธิตอื่น","items":[{"kind":"example","en":"Only the services listed for this category can be reserved. This is not a full catalogue of official transactions.","th":"จองได้เฉพาะบริการที่อยู่ในหมวดนี้ ไม่ใช่รายการธุรกรรมทางการทั้งหมด"},{"kind":"copy","en":"Print or save this demonstration confirmation.","th":"พิมพ์หรือบันทึกใบยืนยันของระบบสาธิตนี้"}]}]$cfg$::jsonb, array['riverside', 'canal', 'coastal', 'campus']::text[], array[]::text[], $cfg${"timezone":"Asia/Bangkok","horizonDays":21}$cfg$::jsonb
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  description = excluded.description,
  description_th = excluded.description_th,
  icon = excluded.icon,
  active = excluded.active,
  sort_order = excluded.sort_order,
  conditional_fields = excluded.conditional_fields,
  document_sets = excluded.document_sets,
  eligible_office_slugs = excluded.eligible_office_slugs,
  vehicle_slugs = excluded.vehicle_slugs,
  slot_rules = excluded.slot_rules;

insert into public.services (
  slug, name, name_th, category, category_th, requires_vehicle, document_guidance, sort_order, active
) values (
  'new-car', 'First-time application — car', 'คำขอครั้งแรก — รถยนต์', 'new-thai-licence', 'ใบอนุญาตขับขี่ไทยใหม่', false, $cfg${"summary_en":"These are sample demonstration requirements, not official legal or government guidance. Confirm every requirement through official channels before a real visit.","summary_th":"รายการนี้เป็นตัวอย่างสำหรับระบบสาธิต ไม่ใช่คำแนะนำทางกฎหมายหรือของหน่วยงานราชการ โปรดตรวจสอบข้อกำหนดจริงผ่านช่องทางทางการก่อนไปติดต่อ","items":[{"en":"Follow the single checklist for the booking category you select. This service does not add another requirement list.","th":"ใช้รายการเอกสารชุดเดียวของหมวดการจองที่เลือก บริการนี้ไม่ได้เพิ่มรายการเอกสารอีกชุด"}]}$cfg$::jsonb, 1, true
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  category = excluded.category,
  category_th = excluded.category_th,
  requires_vehicle = excluded.requires_vehicle,
  document_guidance = excluded.document_guidance,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.services (
  slug, name, name_th, category, category_th, requires_vehicle, document_guidance, sort_order, active
) values (
  'new-motorcycle', 'First-time application — motorcycle', 'คำขอครั้งแรก — รถจักรยานยนต์', 'new-thai-licence', 'ใบอนุญาตขับขี่ไทยใหม่', false, $cfg${"summary_en":"These are sample demonstration requirements, not official legal or government guidance. Confirm every requirement through official channels before a real visit.","summary_th":"รายการนี้เป็นตัวอย่างสำหรับระบบสาธิต ไม่ใช่คำแนะนำทางกฎหมายหรือของหน่วยงานราชการ โปรดตรวจสอบข้อกำหนดจริงผ่านช่องทางทางการก่อนไปติดต่อ","items":[{"en":"Follow the single checklist for the booking category you select. This service does not add another requirement list.","th":"ใช้รายการเอกสารชุดเดียวของหมวดการจองที่เลือก บริการนี้ไม่ได้เพิ่มรายการเอกสารอีกชุด"}]}$cfg$::jsonb, 2, true
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  category = excluded.category,
  category_th = excluded.category_th,
  requires_vehicle = excluded.requires_vehicle,
  document_guidance = excluded.document_guidance,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.services (
  slug, name, name_th, category, category_th, requires_vehicle, document_guidance, sort_order, active
) values (
  'renewal-car', 'Renewal — car', 'ต่ออายุ — รถยนต์', 'thai-renewal', 'ต่ออายุใบอนุญาตขับขี่ไทย', false, $cfg${"summary_en":"These are sample demonstration requirements, not official legal or government guidance. Confirm every requirement through official channels before a real visit.","summary_th":"รายการนี้เป็นตัวอย่างสำหรับระบบสาธิต ไม่ใช่คำแนะนำทางกฎหมายหรือของหน่วยงานราชการ โปรดตรวจสอบข้อกำหนดจริงผ่านช่องทางทางการก่อนไปติดต่อ","items":[{"en":"Follow the single checklist for the booking category you select. This service does not add another requirement list.","th":"ใช้รายการเอกสารชุดเดียวของหมวดการจองที่เลือก บริการนี้ไม่ได้เพิ่มรายการเอกสารอีกชุด"}]}$cfg$::jsonb, 3, true
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  category = excluded.category,
  category_th = excluded.category_th,
  requires_vehicle = excluded.requires_vehicle,
  document_guidance = excluded.document_guidance,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.services (
  slug, name, name_th, category, category_th, requires_vehicle, document_guidance, sort_order, active
) values (
  'renewal-motorcycle', 'Renewal — motorcycle', 'ต่ออายุ — รถจักรยานยนต์', 'thai-renewal', 'ต่ออายุใบอนุญาตขับขี่ไทย', false, $cfg${"summary_en":"These are sample demonstration requirements, not official legal or government guidance. Confirm every requirement through official channels before a real visit.","summary_th":"รายการนี้เป็นตัวอย่างสำหรับระบบสาธิต ไม่ใช่คำแนะนำทางกฎหมายหรือของหน่วยงานราชการ โปรดตรวจสอบข้อกำหนดจริงผ่านช่องทางทางการก่อนไปติดต่อ","items":[{"en":"Follow the single checklist for the booking category you select. This service does not add another requirement list.","th":"ใช้รายการเอกสารชุดเดียวของหมวดการจองที่เลือก บริการนี้ไม่ได้เพิ่มรายการเอกสารอีกชุด"}]}$cfg$::jsonb, 4, true
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  category = excluded.category,
  category_th = excluded.category_th,
  requires_vehicle = excluded.requires_vehicle,
  document_guidance = excluded.document_guidance,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.services (
  slug, name, name_th, category, category_th, requires_vehicle, document_guidance, sort_order, active
) values (
  'conversion', 'Convert a foreign licence', 'แปลงใบอนุญาตต่างประเทศ', 'foreign-conversion', 'แปลงใบอนุญาตต่างประเทศ', false, $cfg${"summary_en":"These are sample demonstration requirements, not official legal or government guidance. Confirm every requirement through official channels before a real visit.","summary_th":"รายการนี้เป็นตัวอย่างสำหรับระบบสาธิต ไม่ใช่คำแนะนำทางกฎหมายหรือของหน่วยงานราชการ โปรดตรวจสอบข้อกำหนดจริงผ่านช่องทางทางการก่อนไปติดต่อ","items":[{"en":"Follow the single checklist for the booking category you select. This service does not add another requirement list.","th":"ใช้รายการเอกสารชุดเดียวของหมวดการจองที่เลือก บริการนี้ไม่ได้เพิ่มรายการเอกสารอีกชุด"}]}$cfg$::jsonb, 5, true
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  category = excluded.category,
  category_th = excluded.category_th,
  requires_vehicle = excluded.requires_vehicle,
  document_guidance = excluded.document_guidance,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.services (
  slug, name, name_th, category, category_th, requires_vehicle, document_guidance, sort_order, active
) values (
  'change-type', 'Change licence type', 'เปลี่ยนประเภทใบอนุญาต', 'change-or-replace', 'เปลี่ยนหรือออกใบแทน', true, $cfg${"summary_en":"These are sample demonstration requirements, not official legal or government guidance. Confirm every requirement through official channels before a real visit.","summary_th":"รายการนี้เป็นตัวอย่างสำหรับระบบสาธิต ไม่ใช่คำแนะนำทางกฎหมายหรือของหน่วยงานราชการ โปรดตรวจสอบข้อกำหนดจริงผ่านช่องทางทางการก่อนไปติดต่อ","items":[{"en":"Follow the single checklist for the booking category you select. This service does not add another requirement list.","th":"ใช้รายการเอกสารชุดเดียวของหมวดการจองที่เลือก บริการนี้ไม่ได้เพิ่มรายการเอกสารอีกชุด"}]}$cfg$::jsonb, 6, true
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  category = excluded.category,
  category_th = excluded.category_th,
  requires_vehicle = excluded.requires_vehicle,
  document_guidance = excluded.document_guidance,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.services (
  slug, name, name_th, category, category_th, requires_vehicle, document_guidance, sort_order, active
) values (
  'replace-card', 'Replace a lost or damaged licence', 'ออกใบแทนกรณีสูญหายหรือชำรุด', 'change-or-replace', 'เปลี่ยนหรือออกใบแทน', false, $cfg${"summary_en":"These are sample demonstration requirements, not official legal or government guidance. Confirm every requirement through official channels before a real visit.","summary_th":"รายการนี้เป็นตัวอย่างสำหรับระบบสาธิต ไม่ใช่คำแนะนำทางกฎหมายหรือของหน่วยงานราชการ โปรดตรวจสอบข้อกำหนดจริงผ่านช่องทางทางการก่อนไปติดต่อ","items":[{"en":"Follow the single checklist for the booking category you select. This service does not add another requirement list.","th":"ใช้รายการเอกสารชุดเดียวของหมวดการจองที่เลือก บริการนี้ไม่ได้เพิ่มรายการเอกสารอีกชุด"}]}$cfg$::jsonb, 7, true
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  category = excluded.category,
  category_th = excluded.category_th,
  requires_vehicle = excluded.requires_vehicle,
  document_guidance = excluded.document_guidance,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.services (
  slug, name, name_th, category, category_th, requires_vehicle, document_guidance, sort_order, active
) values (
  'update-details', 'Update details', 'แก้รายละเอียด', 'change-or-replace', 'เปลี่ยนหรือออกใบแทน', false, $cfg${"summary_en":"These are sample demonstration requirements, not official legal or government guidance. Confirm every requirement through official channels before a real visit.","summary_th":"รายการนี้เป็นตัวอย่างสำหรับระบบสาธิต ไม่ใช่คำแนะนำทางกฎหมายหรือของหน่วยงานราชการ โปรดตรวจสอบข้อกำหนดจริงผ่านช่องทางทางการก่อนไปติดต่อ","items":[{"en":"Follow the single checklist for the booking category you select. This service does not add another requirement list.","th":"ใช้รายการเอกสารชุดเดียวของหมวดการจองที่เลือก บริการนี้ไม่ได้เพิ่มรายการเอกสารอีกชุด"}]}$cfg$::jsonb, 8, true
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  category = excluded.category,
  category_th = excluded.category_th,
  requires_vehicle = excluded.requires_vehicle,
  document_guidance = excluded.document_guidance,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.services (
  slug, name, name_th, category, category_th, requires_vehicle, document_guidance, sort_order, active
) values (
  'class-upgrade', 'Upgrade a licence class', 'เพิ่มชั้นใบอนุญาต', 'change-or-replace', 'เปลี่ยนหรือออกใบแทน', true, $cfg${"summary_en":"These are sample demonstration requirements, not official legal or government guidance. Confirm every requirement through official channels before a real visit.","summary_th":"รายการนี้เป็นตัวอย่างสำหรับระบบสาธิต ไม่ใช่คำแนะนำทางกฎหมายหรือของหน่วยงานราชการ โปรดตรวจสอบข้อกำหนดจริงผ่านช่องทางทางการก่อนไปติดต่อ","items":[{"en":"Follow the single checklist for the booking category you select. This service does not add another requirement list.","th":"ใช้รายการเอกสารชุดเดียวของหมวดการจองที่เลือก บริการนี้ไม่ได้เพิ่มรายการเอกสารอีกชุด"}]}$cfg$::jsonb, 9, false
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  category = excluded.category,
  category_th = excluded.category_th,
  requires_vehicle = excluded.requires_vehicle,
  document_guidance = excluded.document_guidance,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.services (
  slug, name, name_th, category, category_th, requires_vehicle, document_guidance, sort_order, active
) values (
  'idp', 'International driving permit', 'ใบอนุญาตขับขี่ระหว่างประเทศ', 'international-permit', 'ใบอนุญาตขับขี่ระหว่างประเทศ', true, $cfg${"summary_en":"These are sample demonstration requirements, not official legal or government guidance. Confirm every requirement through official channels before a real visit.","summary_th":"รายการนี้เป็นตัวอย่างสำหรับระบบสาธิต ไม่ใช่คำแนะนำทางกฎหมายหรือของหน่วยงานราชการ โปรดตรวจสอบข้อกำหนดจริงผ่านช่องทางทางการก่อนไปติดต่อ","items":[{"en":"Follow the single checklist for the booking category you select. This service does not add another requirement list.","th":"ใช้รายการเอกสารชุดเดียวของหมวดการจองที่เลือก บริการนี้ไม่ได้เพิ่มรายการเอกสารอีกชุด"}]}$cfg$::jsonb, 10, true
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  category = excluded.category,
  category_th = excluded.category_th,
  requires_vehicle = excluded.requires_vehicle,
  document_guidance = excluded.document_guidance,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.services (
  slug, name, name_th, category, category_th, requires_vehicle, document_guidance, sort_order, active
) values (
  'vehicle-counter', 'Vehicle counter demonstration', 'สาธิตเคาน์เตอร์ยานพาหนะ', 'other-demo', 'บริการสาธิตอื่น', true, $cfg${"summary_en":"These are sample demonstration requirements, not official legal or government guidance. Confirm every requirement through official channels before a real visit.","summary_th":"รายการนี้เป็นตัวอย่างสำหรับระบบสาธิต ไม่ใช่คำแนะนำทางกฎหมายหรือของหน่วยงานราชการ โปรดตรวจสอบข้อกำหนดจริงผ่านช่องทางทางการก่อนไปติดต่อ","items":[{"en":"Follow the single checklist for the booking category you select. This service does not add another requirement list.","th":"ใช้รายการเอกสารชุดเดียวของหมวดการจองที่เลือก บริการนี้ไม่ได้เพิ่มรายการเอกสารอีกชุด"}]}$cfg$::jsonb, 11, true
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  category = excluded.category,
  category_th = excluded.category_th,
  requires_vehicle = excluded.requires_vehicle,
  document_guidance = excluded.document_guidance,
  sort_order = excluded.sort_order,
  active = excluded.active;

insert into public.services (
  slug, name, name_th, category, category_th, requires_vehicle, document_guidance, sort_order, active
) values (
  'general-counter', 'General counter demonstration', 'สาธิตเคาน์เตอร์ทั่วไป', 'other-demo', 'บริการสาธิตอื่น', false, $cfg${"summary_en":"These are sample demonstration requirements, not official legal or government guidance. Confirm every requirement through official channels before a real visit.","summary_th":"รายการนี้เป็นตัวอย่างสำหรับระบบสาธิต ไม่ใช่คำแนะนำทางกฎหมายหรือของหน่วยงานราชการ โปรดตรวจสอบข้อกำหนดจริงผ่านช่องทางทางการก่อนไปติดต่อ","items":[{"en":"Follow the single checklist for the booking category you select. This service does not add another requirement list.","th":"ใช้รายการเอกสารชุดเดียวของหมวดการจองที่เลือก บริการนี้ไม่ได้เพิ่มรายการเอกสารอีกชุด"}]}$cfg$::jsonb, 12, true
)
on conflict (slug) do update set
  name = excluded.name,
  name_th = excluded.name_th,
  category = excluded.category,
  category_th = excluded.category_th,
  requires_vehicle = excluded.requires_vehicle,
  document_guidance = excluded.document_guidance,
  sort_order = excluded.sort_order,
  active = excluded.active;


insert into public.time_slots (office_id, service_id, starts_at, ends_at, capacity, active)
select source.office_id, target.id, source.starts_at, source.ends_at, source.capacity, true
from public.services target
join public.services donor on donor.slug = 'new-car'
join public.time_slots source on source.service_id = donor.id and source.starts_at > now()
where target.active
  and target.slug in ('change-type', 'replace-card', 'update-details', 'idp')
  and not exists (
    select 1 from public.time_slots existing
    where existing.service_id = target.id
      and existing.office_id = source.office_id
      and existing.starts_at = source.starts_at
  );
