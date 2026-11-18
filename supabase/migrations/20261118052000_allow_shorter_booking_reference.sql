-- A saved reference may use thirteen digits after W, as in W2026111885783RBY.
-- Fourteen-digit references and older VD- references stay valid.

alter table public.bookings drop constraint bookings_reference_check;

alter table public.bookings
  add constraint bookings_reference_check
  check (reference ~ '^(VD-[A-Z2-9]{4}-[A-Z2-9]{4}|W[0-9]{13,14}[A-Z]{3})$');
