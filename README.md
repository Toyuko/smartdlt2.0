# SmartDLT2.0

SmartDLT2.0 is a demonstration appointment desk inspired by the flow of a transport-office queue. It is **not** an official Department of Land Transport service. Bookings, QR codes, and verification results exist only in this application's database.

The notice below is shown throughout the interface:

> DEMONSTRATION SYSTEM — NOT AN OFFICIAL DLT SERVICE. Appointments and QR codes are for demonstration and testing only and are not valid for government services.

## Stack

- Next.js App Router and TypeScript
- React and Tailwind CSS
- Supabase Postgres, Auth, and Row Level Security
- Zod and React Hook Form
- `qrcode` for images and `html5-qrcode` for the staff camera, with manual reference entry
- Vitest, React Testing Library, and Playwright

Apply every file in `supabase/migrations/` in order, starting with `20261021143000_init.sql`. See `ARCHITECTURE.md` for the request path and status rules.

## Local setup

1. Create a Supabase project.
2. In the SQL editor, run the files in `supabase/migrations/` in filename order.
   With the Supabase CLI, from this directory: `supabase db push` after linking the project.
3. Copy `.env.example` to `.env.local` and fill in the URL, anon key, and service-role key.
4. Install and seed:

```bash
npm install
npm run seed
```

`npm run seed` upserts fictional offices and services, then adds about two weeks of Bangkok-time slots and a few synthetic bookings. It does not replace existing slots. Sample QR tokens are written to `demo-fixtures.local.json`, which is gitignored. Published references such as `VD-SAMP-CONF` are fixtures, not government identifiers.

5. Start the app:

```bash
npm run dev
```

If the Supabase variables are missing, pages that need the database show a setup error. Bookings are not stored in browser memory.

## Staff account

There is no default password in the repository. In the Supabase dashboard, disable public sign-up. Then provision the first staff profile:

```bash
ALLOW_STAFF_BOOTSTRAP=true \
STAFF_BOOTSTRAP_SECRET="$(openssl rand -base64 32)" \
STAFF_EMAIL="staff@example.com" \
STAFF_PASSWORD="choose-a-long-password" \
npm run bootstrap-staff -- --confirm
```

Keep `STAFF_PASSWORD` and `SUPABASE_SERVICE_ROLE_KEY` in the environment only. The script creates a confirmed Auth user and an `admin` row in `staff_profiles`. Sign in at `/staff/login`.

## Verification behaviour

A QR code contains only `{APP_BASE_URL}/demo-ticket/{opaque-token}`. Set `APP_BASE_URL` to the public origin of the deployment that should open when the code is scanned. The database stores the SHA-256 hash of that token. The raw token is returned once, when the booking is created, and is not written to the database. Opening the QR loads `/demo-ticket/{token}` from the database. `/booking-confirmation/{reference}` shows the same saved booking. Lookup by reference still shows the public summary.

Apply `supabase/migrations/20261022013000_booking_ticket_guidance.sql` with the earlier migrations before using the new ticket pages. It adds `bookings.document_guidance` and extends `reserve_demo_booking`. The service-role key stays on the server.

Staff scan and manual entry return one of: valid demo booking, already checked in, cancelled, completed, expired or invalid token, or booking not found. "Valid" means the row exists here. It does not mean a government office accepted it.

Check-in, completion, and cancellation go through `transition_booking`. That function rejects duplicate check-ins and other illegal jumps, and it writes an audit row with the previous and next status.

## Reset demo data

Reset deletes bookings, audit rows, rate-limit buckets, and time slots, then seeds again. It runs only when you opt in:

```bash
DEMO_RESET_ENABLED=true npm run reset-demo
```

On Vercel production it also requires `DEMO_RESET_ALLOW_PRODUCTION=true`. Do not point that at a database you cannot wipe.

## Tests

```bash
npm test
npm run test:e2e
```

Unit tests cover validation, the QR payload, the calendar, and the disclaimer. The database test runs the migration on PGlite and checks capacity, idempotency, status transitions, rate limits, and public-role denial. Playwright covers the landing flow, Thai copy, lookup validation, and the locked staff API.

A true two-connection race is serialized in Postgres by `SELECT … FOR UPDATE` on the slot. The PGlite test calls the same function until the seat is gone. Hosted concurrency can be checked by sending parallel `POST /api/bookings` requests at one slot after deployment.

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import it as a Vercel project. Framework preset: Next.js.
3. Add the environment variables from `.env.example` for Preview and Production. Use different Supabase projects if you want the preview data isolated. Set `APP_BASE_URL` to that deployment's public origin so QR codes do not point at localhost.
4. Apply every file in `supabase/migrations/` to the matching Supabase project, including `20261022013000_booking_ticket_guidance.sql`, and run the seed with that project's service-role key.
5. Open a preview deployment and run:

```bash
npm run smoke -- https://your-preview.vercel.app
```

6. Bootstrap a staff user against that database, then sign in on the preview and scan a QR you created there.
7. Promote the deployment to production when the smoke check and a manual booking both succeed.

Never commit `.env.local`. The service-role key is read only on the server.

## Privacy

Do not type real national ID numbers, passport numbers, or government passwords. Optional email and phone are stored for the demo and are omitted from public lookup and from the QR. Reset or delete the Supabase project when the demonstration is finished.
