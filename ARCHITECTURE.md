# Violet Desk — architecture and implementation plan

Violet Desk is an independently hosted demonstration of a multistep appointment desk. It is not the Department of Land Transport Smart Queue, and it must not be described as issuing or validating official appointments.

The database migration in `supabase/migrations/20261021143000_init.sql` is the only schema contract. Application code maps to that schema. Do not add a second booking model or an in-memory fallback that pretends to persist appointments.

## Milestones

1. Schema, Row Level Security, reservation function, and seed data.
2. Design system, bilingual shell, and persistent demonstration notice.
3. Public wizard, server-side validation, capacity reservation, and confirmation.
4. Opaque verification tokens, QR display, lookup, and staff status transitions.
5. Automated tests, deployment documentation, and a preview smoke check.

## Request path

Visitors do not need an account. The browser calls same-origin route handlers. Those handlers use the Supabase service role, which never ships to the client. Public catalog reads use the anon key so Row Level Security stays in the path.

```text
Browser wizard
  -> POST /api/bookings
    -> Zod validation
    -> rate limit
    -> reserve_demo_booking()  (row lock + capacity check + insert)
  -> confirmation page
    -> QR encodes only {APP_ORIGIN}/v/{opaque-token}

Staff browser
  -> Supabase Auth session cookie
  -> proxy.ts optimistic session check
  -> requireStaff() loads staff_profiles with the service role
  -> transition_booking() is the only status write
```

## Booking rules

- Timezone for display and day boundaries is `Asia/Bangkok`. Stored values are `timestamptz`.
- A slot can be reserved only while it is active, matches the office and service, starts in the future, and has remaining capacity among rows whose status is not `cancelled`.
- `reserve_demo_booking` locks the slot row with `FOR UPDATE` before counting. Concurrent reservations serialize on that row.
- The client sends an idempotency key. A repeated key returns the original booking and does not consume another seat. The raw verification token is returned only on the first success and is stored only as a SHA-256 hash.
- Status changes go through `transition_booking`: `confirmed -> checked_in -> completed`, and `confirmed` or `checked_in -> cancelled`. Duplicate check-ins and other jumps are rejected. Each successful change writes an audit row with status metadata only.

## Verification outcomes

Token and reference checks return one of: valid demo booking, already checked in, cancelled, completed, expired, invalid token, or booking not found. Expired and invalid token share the visitor-facing wording "Expired or invalid token". Completed is reported separately so a finished demo record is not described as still valid for check-in. A valid result means the row exists in this demo database.

## What the QR may contain

The QR payload is a URL on this application's origin whose path is `/v/` plus the opaque token. It has no query string and no applicant name, email, phone, notes, or document numbers.

## Row Level Security

Anon and authenticated clients may read active offices, services, vehicle categories, and time slots. They may execute `list_slot_availability`, which returns capacities and remaining counts only. They cannot read bookings, audit logs, staff profiles, or rate-limit buckets, and they cannot execute reservation, transition, or rate-limit functions. Those functions are granted to `service_role` and run as security definer with a fixed search path.

## File ownership

| Area | Files |
| --- | --- |
| UI and wizard | `components/`, `app/(public pages)`, `lib/i18n/` |
| Database and security | `supabase/migrations/`, `lib/data/`, `lib/booking/create-booking.ts`, `scripts/seed.ts`, `scripts/reset-demo.ts` |
| QR and staff | `lib/booking/tokens.ts`, `app/staff/`, `app/v/`, `app/api/staff/` |
| QA | `tests/`, `e2e/`, `scripts/smoke-preview.ts` |

## Environment

Missing `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` produces a setup error. The app does not substitute memory storage. `APP_BASE_URL` is the origin encoded in new QR codes when it is set.
