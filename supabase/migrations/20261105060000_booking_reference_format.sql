-- New booking references look like W20261029113827AQD:
-- W, the Bangkok calendar date, six random digits, and three letters.
-- Older VD- references stay valid so saved confirmation links still open.

alter table public.bookings drop constraint bookings_reference_check;

update public.bookings as booking
set reference = mapped.new_reference
from (
  values
    ('VD-SAMP-CONF', 'W20261105090001CNF'),
    ('VD-SAMP-CHKD', 'W20261105100001CHK'),
    ('VD-SAMP-DONE', 'W20261105110001DON'),
    ('VD-SAMP-CANC', 'W20261105120001CAN'),
    ('VD-SAMP-EXPR', 'W20261104130001EXP')
) as mapped(old_reference, new_reference)
where booking.reference = mapped.old_reference
  and not exists (
    select 1 from public.bookings as existing where existing.reference = mapped.new_reference
  );

alter table public.bookings
  add constraint bookings_reference_check
  check (reference ~ '^(VD-[A-Z2-9]{4}-[A-Z2-9]{4}|W[0-9]{14}[A-Z]{3})$');
