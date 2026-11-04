-- Adds a demonstration service for renewing a car licence and a motorcycle licence in one visit.
-- Copies future slots from the car renewal so the new choice can be booked.

update public.services
set sort_order = sort_order + 1
where slug <> 'renewal-car-motorcycle'
  and sort_order >= 5
  and exists (
    select 1 from public.services where slug = 'conversion' and sort_order = 5
  );

insert into public.services (
  slug, name, name_th, category, category_th, requires_vehicle, document_guidance, sort_order, active
)
select
  'renewal-car-motorcycle',
  'Renewal — car and motorcycle',
  'ต่ออายุ — รถยนต์และรถจักรยานยนต์',
  donor.category,
  donor.category_th,
  false,
  donor.document_guidance,
  5,
  true
from public.services donor
where donor.slug = 'renewal-car'
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
join public.services donor on donor.slug = 'renewal-car'
join public.time_slots source on source.service_id = donor.id and source.starts_at > now()
where target.slug = 'renewal-car-motorcycle'
  and not exists (
    select 1 from public.time_slots existing
    where existing.service_id = target.id
      and existing.office_id = source.office_id
      and existing.starts_at = source.starts_at
  );
