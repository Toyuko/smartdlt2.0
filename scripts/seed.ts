import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { bookingCategorySeed, categoryToRow } from "../lib/booking/categories";
import { officeSeed, SAMPLE_REFERENCES, serviceSeed, SLOT_CAPACITY, SLOT_PERIODS, vehicleCategorySeed } from "../lib/demo-catalog";
import { generateToken, hashToken } from "../lib/booking/token-core";
import { bangkokDateParts, shiftIsoDate, weekdayBangkok } from "../lib/time";

type SeedOptions = { replace: boolean };

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. Copy .env.example to .env.local and fill in the demo Supabase project.`);
    process.exit(1);
  }
  return value;
}

export async function seedDemo(options: SeedOptions) {
  const supabase = createClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const vehicles = await supabase.from("vehicle_categories").upsert(vehicleCategorySeed, { onConflict: "slug" }).select("slug");
  const categories = await supabase.from("booking_categories").upsert(bookingCategorySeed.map(categoryToRow), { onConflict: "slug" });
  const offices = await supabase.from("offices").upsert(officeSeed, { onConflict: "slug" }).select("id, slug");
  const services = await supabase.from("services").upsert(serviceSeed, { onConflict: "slug" }).select("id, slug");
  if (vehicles.error || categories.error || offices.error || services.error) {
    throw new Error(vehicles.error?.message || categories.error?.message || offices.error?.message || services.error?.message);
  }

  if (options.replace) {
    const wipedAudit = await supabase.from("audit_logs").delete().not("id", "is", null);
    const wipedBookings = await supabase.from("bookings").delete().not("id", "is", null);
    const wipedSlots = await supabase.from("time_slots").delete().not("id", "is", null);
    const wipedLimits = await supabase.from("rate_limit_buckets").delete().not("bucket", "is", null);
    const wipeError = wipedAudit.error || wipedBookings.error || wipedSlots.error || wipedLimits.error;
    if (wipeError) throw new Error(wipeError.message);
  }

  const existing = await supabase.from("time_slots").select("id", { count: "exact", head: true });
  if (existing.error) throw new Error(existing.error.message);
  if ((existing.count ?? 0) > 0) {
    console.log("Time slots already exist. Run npm run reset-demo to replace bookings and slots.");
    return;
  }

  const officeRows = offices.data ?? [];
  const activeSlugs = new Set(serviceSeed.filter((item) => item.active !== false).map((item) => item.slug));
  const serviceRows = (services.data ?? []).filter((service) => activeSlugs.has(service.slug));
  const dates = upcomingDates(14);
  const now = Date.now();
  const slotRows = [];
  for (const office of officeRows) {
    for (const service of serviceRows) {
      for (const date of dates) {
        for (const [start, end] of SLOT_PERIODS) {
          const startsAt = new Date(`${date}T${start}:00+07:00`);
          if (startsAt.getTime() <= now) continue;
          slotRows.push({
            office_id: office.id,
            service_id: service.id,
            starts_at: startsAt.toISOString(),
            ends_at: new Date(`${date}T${end}:00+07:00`).toISOString(),
            capacity: SLOT_CAPACITY,
            active: true,
          });
        }
      }
    }
  }

  for (let index = 0; index < slotRows.length; index += 200) {
    const inserted = await supabase.from("time_slots").insert(slotRows.slice(index, index + 200));
    if (inserted.error) throw new Error(inserted.error.message);
  }

  await insertSamples(supabase, officeRows, serviceRows);
  console.log("Demo offices, services, slots, and sample bookings are ready.");
}

function upcomingDates(count: number) {
  const dates: string[] = [];
  let cursor = bangkokDateParts().isoDate;
  let scanned = 0;
  while (dates.length < count && scanned < 40) {
    if (weekdayBangkok(cursor) !== "Sun") dates.push(cursor);
    cursor = shiftIsoDate(cursor, 1);
    scanned += 1;
  }
  return dates;
}

async function insertSamples(
  supabase: SupabaseClient,
  offices: Array<{ id: string; slug: string }>,
  services: Array<{ id: string; slug: string }>,
) {
  const office = offices.find((item) => item.slug === "riverside") ?? offices[0];
  const renewal = services.find((item) => item.slug === "renewal-car") ?? services[0];
  const general = services.find((item) => item.slug === "general-counter") ?? services[0];
  if (!office || !renewal || !general) return;

  const dates = upcomingDates(14);
  const fullDate = dates[1];
  const sampleDate = dates[2];
  if (fullDate && sampleDate) {
    const fullSlots = await supabase
      .from("time_slots")
      .select("id, capacity")
      .eq("office_id", office.id)
      .eq("service_id", renewal.id)
      .gte("starts_at", new Date(`${fullDate}T00:00:00+07:00`).toISOString())
      .lt("starts_at", new Date(`${shiftIsoDate(fullDate, 1)}T00:00:00+07:00`).toISOString());
    if (fullSlots.error) throw new Error(fullSlots.error.message);
    const fillers = [];
    for (const slot of fullSlots.data ?? []) {
      for (let seat = 0; seat < slot.capacity; seat += 1) {
        fillers.push(bookingRow({
          officeId: office.id,
          serviceId: renewal.id,
          slotId: slot.id,
          name: `Capacity Sample ${seat + 1}`,
          status: "confirmed",
          vehicle: "car",
        }));
      }
    }
    if (fillers.length) {
      const inserted = await supabase.from("bookings").insert(fillers);
      if (inserted.error) throw new Error(inserted.error.message);
    }

    const sampleSlots = await supabase
      .from("time_slots")
      .select("id")
      .eq("office_id", office.id)
      .eq("service_id", general.id)
      .gte("starts_at", new Date(`${sampleDate}T00:00:00+07:00`).toISOString())
      .lt("starts_at", new Date(`${shiftIsoDate(sampleDate, 1)}T00:00:00+07:00`).toISOString())
      .order("starts_at");
    if (sampleSlots.error) throw new Error(sampleSlots.error.message);
    const slotIds = (sampleSlots.data ?? []).map((slot) => slot.id);
    const fixtures = [
      [SAMPLE_REFERENCES.confirmed, "confirmed", slotIds[0]],
      [SAMPLE_REFERENCES.checkedIn, "checked_in", slotIds[1]],
      [SAMPLE_REFERENCES.completed, "completed", slotIds[2]],
      [SAMPLE_REFERENCES.cancelled, "cancelled", slotIds[3]],
    ] as const;
    const tokens: Record<string, string> = {};
    const rows = fixtures.flatMap(([reference, status, slotId]) => {
      if (!slotId) return [];
      const token = generateToken();
      tokens[reference] = token;
      return [bookingRow({ officeId: office.id, serviceId: general.id, slotId, name: `Sample Visitor ${status}`, status, reference, token, vehicle: null })];
    });

    const yesterday = shiftIsoDate(bangkokDateParts().isoDate, -1);
    const pastSlot = await supabase
      .from("time_slots")
      .insert({
        office_id: office.id,
        service_id: general.id,
        starts_at: new Date(`${yesterday}T09:00:00+07:00`).toISOString(),
        ends_at: new Date(`${yesterday}T10:00:00+07:00`).toISOString(),
        capacity: 2,
        active: true,
      })
      .select("id")
      .single();
    if (pastSlot.error) throw new Error(pastSlot.error.message);
    const expiredToken = generateToken();
    tokens[SAMPLE_REFERENCES.expired] = expiredToken;
    rows.push(
      bookingRow({
        officeId: office.id,
        serviceId: general.id,
        slotId: pastSlot.data.id,
        name: "Sample Visitor expired",
        status: "confirmed",
        reference: SAMPLE_REFERENCES.expired,
        token: expiredToken,
        vehicle: null,
      }),
    );
    const inserted = await supabase.from("bookings").insert(rows);
    if (inserted.error) throw new Error(inserted.error.message);
    writeFileSync("demo-fixtures.local.json", JSON.stringify(tokens, null, 2));
    console.log("Sample QR tokens were written to demo-fixtures.local.json and are not committed.");
  }
}

function bookingRow(input: {
  officeId: string;
  serviceId: string;
  slotId: string;
  name: string;
  status: "confirmed" | "checked_in" | "completed" | "cancelled";
  reference?: string;
  token?: string;
  vehicle: string | null;
}) {
  const token = input.token ?? generateToken();
  const now = new Date().toISOString();
  return {
    reference: input.reference ?? generateReferenceSafe(),
    office_id: input.officeId,
    service_id: input.serviceId,
    time_slot_id: input.slotId,
    vehicle_category: input.vehicle,
    applicant_display_name: input.name,
    status: input.status,
    verification_token_hash: hashToken(token),
    idempotency_key: crypto.randomUUID(),
    checked_in_at: input.status === "checked_in" || input.status === "completed" ? now : null,
    completed_at: input.status === "completed" ? now : null,
    cancelled_at: input.status === "cancelled" ? now : null,
  };
}

function generateReferenceSafe() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chars = Array.from(crypto.getRandomValues(new Uint8Array(8)), (value) => alphabet[value % alphabet.length]).join("");
  return `VD-${chars.slice(0, 4)}-${chars.slice(4)}`;
}

const entry = process.argv[1];
if (entry && import.meta.url === pathToFileURL(entry).href) {
  seedDemo({ replace: false }).catch((error: Error) => {
    console.error(error.message);
    process.exit(1);
  });
}
