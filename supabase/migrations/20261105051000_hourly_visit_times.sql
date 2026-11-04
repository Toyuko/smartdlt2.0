-- Replaces the fixed 08:30 and 09:30 demonstration windows with hourly visits
-- from 09:00 through 16:00 Bangkok time. Existing 13:00 and 14:00 windows stay.

with days as (
  select
    office_id,
    service_id,
    (starts_at at time zone 'Asia/Bangkok')::date as service_date,
    max(capacity) as capacity
  from public.time_slots
  where active
    and starts_at > now()
  group by office_id, service_id, (starts_at at time zone 'Asia/Bangkok')::date
),
periods (start_time, end_time) as (
  values
    (time '09:00', time '10:00'),
    (time '10:00', time '11:00'),
    (time '11:00', time '12:00'),
    (time '12:00', time '13:00'),
    (time '13:00', time '14:00'),
    (time '14:00', time '15:00'),
    (time '15:00', time '16:00')
)
insert into public.time_slots (office_id, service_id, starts_at, ends_at, capacity, active)
select
  d.office_id,
  d.service_id,
  (d.service_date + p.start_time) at time zone 'Asia/Bangkok',
  (d.service_date + p.end_time) at time zone 'Asia/Bangkok',
  d.capacity,
  true
from days d
cross join periods p
where (d.service_date + p.start_time) at time zone 'Asia/Bangkok' > now()
  and not exists (
    select 1
    from public.time_slots existing
    where existing.office_id = d.office_id
      and existing.service_id = d.service_id
      and existing.starts_at = (d.service_date + p.start_time) at time zone 'Asia/Bangkok'
  );

delete from public.time_slots ts
where ts.starts_at > now()
  and to_char(ts.starts_at at time zone 'Asia/Bangkok', 'HH24:MI') in ('08:30', '09:30')
  and not exists (
    select 1 from public.bookings b where b.time_slot_id = ts.id
  );
