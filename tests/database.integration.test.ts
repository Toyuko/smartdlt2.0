// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  const migrations = readdirSync("supabase/migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const name of migrations) {
    await db.exec(readFileSync(path.join("supabase/migrations", name), "utf8"));
  }
  await db.query(
    `insert into offices (id, slug, name, name_th, province, province_th, demo_label)
     values ('11111111-1111-4111-8111-111111111111', 'desk', 'Desk', 'โต๊ะ', 'Test', 'ทดสอบ', 'Demo location')`,
  );
  await db.query(
    `insert into offices (slug, name, name_th, province, province_th, demo_label, active)
     values ('closed', 'Closed', 'ปิด', 'Test', 'ทดสอบ', 'Demo location', false)`,
  );
  await db.query(`insert into vehicle_categories (slug, name, name_th) values ('car', 'Car', 'รถ')`);
  await db.query(
    `insert into services (id, slug, name, name_th, category, category_th, requires_vehicle, document_guidance)
     values ('22222222-2222-4222-8222-222222222222', 'svc', 'Service', 'บริการ', 'other', 'อื่น', true, '{"summary_en":"Sample","summary_th":"ตัวอย่าง","items":[]}'::jsonb)`,
  );
  await db.query(
    `insert into time_slots (id, office_id, service_id, starts_at, ends_at, capacity)
     values ('33333333-3333-4333-8333-333333333333', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', now() + interval '2 days', now() + interval '2 days 1 hour', 1)`,
  );
  await db.query(
    `insert into staff_profiles (user_id, display_name, role)
     values ('55555555-5555-4555-8555-555555555555', 'Tester', 'staff')`,
  );
});

function row<T>(result: { rows: unknown[] }, index = 0) {
  return result.rows[index] as T;
}

async function reserve(reference: string, key: string, slot = "33333333-3333-4333-8333-333333333333") {
  return db.query(
    `select public.reserve_demo_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) as result`,
    [
      "11111111-1111-4111-8111-111111111111",
      "22222222-2222-4222-8222-222222222222",
      slot,
      "car",
      "Sample Visitor",
      null,
      null,
      null,
      key,
      reference,
      key.replaceAll("-", "").padEnd(64, "ab").slice(0, 64),
    ],
  );
}

describe("reservation database", () => {
  it("reserves one seat and then rejects a second booking for a full slot", async () => {
    const first = await reserve("VD-TEST-BOOK", "66666666-6666-4666-8666-666666666666");
    expect(row<{ result: { idempotent: boolean } }>(first).result.idempotent).toBe(false);
    await expect(reserve("VD-TEST-FULL", "77777777-7777-4777-8777-777777777777")).rejects.toThrow(/slot_full/);
  });

  it("replays the same idempotency key without consuming another seat", async () => {
    const replay = await reserve("VD-TEST-OTHR", "66666666-6666-4666-8666-666666666666");
    const replayed = row<{ result: { idempotent: boolean; reference: string } }>(replay).result;
    expect(replayed.idempotent).toBe(true);
    expect(replayed.reference).toBe("VD-TEST-BOOK");
    const count = await db.query(`select count(*)::int as count from bookings where status <> 'cancelled'`);
    expect(row<{ count: number }>(count).count).toBe(1);
  });

  it("rejects a past slot", async () => {
    await db.query(
      `insert into time_slots (id, office_id, service_id, starts_at, ends_at, capacity)
       values ('88888888-8888-4888-8888-888888888888', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', now() - interval '1 day', now() - interval '23 hours', 2)`,
    );
    await expect(reserve("VD-TEST-PAST", "99999999-9999-4999-8999-999999999999", "88888888-8888-4888-8888-888888888888")).rejects.toThrow(/slot_past/);
  });

  it("moves a booking through check-in and completion once", async () => {
    const booking = await db.query(`select id from bookings where reference = 'VD-TEST-BOOK'`);
    const id = row<{ id: string }>(booking).id;
    await db.query(`select public.transition_booking($1, $2, 'check_in')`, [id, "55555555-5555-4555-8555-555555555555"]);
    await expect(db.query(`select public.transition_booking($1, $2, 'check_in')`, [id, "55555555-5555-4555-8555-555555555555"])).rejects.toThrow(/already_checked_in/);
    await db.query(`select public.transition_booking($1, $2, 'complete')`, [id, "55555555-5555-4555-8555-555555555555"]);
    await expect(db.query(`select public.transition_booking($1, $2, 'cancel')`, [id, "55555555-5555-4555-8555-555555555555"])).rejects.toThrow(/invalid_transition/);
    const audit = await db.query(`select action, metadata from audit_logs order by created_at`);
    expect((audit.rows as { action: string }[]).map((entry) => entry.action)).toEqual(["check_in", "complete"]);
    expect(JSON.stringify(audit.rows)).not.toContain("Sample Visitor");
  });

  it("rejects an unauthorised status change", async () => {
    await expect(
      db.query(`select public.transition_booking($1, $2, 'cancel')`, [
        "33333333-3333-4333-8333-333333333333",
        "12121212-1212-4121-8121-121212121212",
      ]),
    ).rejects.toThrow(/unauthorized|not_found/);
  });

  it("rejects a renewal date outside the configured demo window and accepts one inside it", async () => {
    await db.query(`update booking_categories set eligible_office_slugs = eligible_office_slugs || array['desk'] where slug = 'thai-renewal'`);
    const service = await db.query(`select id from services where slug = 'renewal-car'`);
    const serviceId = row<{ id: string }>(service).id;
    await db.query(
      `insert into time_slots (id, office_id, service_id, starts_at, ends_at, capacity)
       values ('14141414-1414-4414-8414-141414141414', '11111111-1111-4111-8111-111111111111', $1, now() + interval '3 days', now() + interval '3 days 1 hour', 2)`,
      [serviceId],
    );
    const soon = await db.query(`select to_char((timezone('Asia/Bangkok', now()))::date + 10, 'YYYY-MM-DD') as expiry`);
    const later = await db.query(`select to_char((timezone('Asia/Bangkok', now()))::date + 200, 'YYYY-MM-DD') as expiry`);
    const soonDate = row<{ expiry: string }>(soon).expiry;
    const laterDate = row<{ expiry: string }>(later).expiry;
    await expect(
      db.query(`select public.reserve_demo_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`, [
        "11111111-1111-4111-8111-111111111111",
        serviceId,
        "14141414-1414-4414-8414-141414141414",
        null,
        "Renewal Visitor",
        null,
        null,
        null,
        "15151515-1515-4515-8515-151515151515",
        "VD-TEST-RENO",
        "c".repeat(64),
        "thai",
        JSON.stringify({ currentLicenceType: "temporary", expiryDate: laterDate }),
      ]),
    ).rejects.toThrow(/renewal_window/);
    const reserved = await db.query(`select public.reserve_demo_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb) as result`, [
      "11111111-1111-4111-8111-111111111111",
      serviceId,
      "14141414-1414-4414-8414-141414141414",
      null,
      "Renewal Visitor",
      null,
      null,
      null,
      "16161616-1616-4616-8616-161616161616",
      "VD-TEST-RENW",
      "d".repeat(64),
      "thai",
      JSON.stringify({ currentLicenceType: "temporary", expiryDate: soonDate }),
    ]);
    expect(row<{ result: { idempotent: boolean } }>(reserved).result.idempotent).toBe(false);
  });

  it("lets only one of two overlapping reservations take the last seat", async () => {
    await db.query(
      `insert into time_slots (id, office_id, service_id, starts_at, ends_at, capacity)
       values ('17171717-1717-4717-8717-171717171717', '11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', now() + interval '4 days', now() + interval '4 days 1 hour', 1)`,
    );
    const attempts = await Promise.allSettled([
      reserve("VD-TEST-RACE", "18181818-1818-4818-8818-181818181818", "17171717-1717-4717-8717-171717171717"),
      reserve("VD-TEST-RAC2", "19191919-1919-4919-8919-191919191919", "17171717-1717-4717-8717-171717171717"),
    ]);
    const fulfilled = attempts.filter((attempt) => attempt.status === "fulfilled");
    const rejected = attempts.filter((attempt) => attempt.status === "rejected");
    const detail = attempts
      .map((attempt) => (attempt.status === "rejected" ? String(attempt.reason) : "reserved"))
      .join(" || ");
    expect(fulfilled, detail).toHaveLength(1);
    expect(rejected, detail).toHaveLength(1);
    expect(String((rejected[0] as PromiseRejectedResult).reason)).toMatch(/slot_full/);
  });

  it("hides bookings and inactive offices from the public role", async () => {
    await db.exec("set role anon");
    try {
      await expect(db.query("select * from bookings")).rejects.toThrow(/permission denied/i);
      const offices = await db.query("select slug from offices order by slug");
      expect((offices.rows as { slug: string }[]).map((entry) => entry.slug)).toEqual(["desk"]);
      const categories = await db.query("select slug from booking_categories where slug = 'new-thai-licence'");
      expect(categories.rows).toHaveLength(1);
      await expect(
        db.query(`select public.reserve_demo_booking($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
          "33333333-3333-4333-8333-333333333333",
          "car",
          "Anon",
          null,
          null,
          null,
          "13131313-1313-4131-8131-131313131313",
          "VD-TEST-ANON",
          "b".repeat(64),
        ]),
      ).rejects.toThrow(/permission denied/i);
    } finally {
      await db.exec("reset role");
    }
  });

  it("enforces the rate limit window", async () => {
    const first = await db.query(`select public.consume_rate_limit('booking_create', 'hash', 2, 3600) as allowed`);
    const second = await db.query(`select public.consume_rate_limit('booking_create', 'hash', 2, 3600) as allowed`);
    const third = await db.query(`select public.consume_rate_limit('booking_create', 'hash', 2, 3600) as allowed`);
    expect(row<{ allowed: boolean }>(first).allowed).toBe(true);
    expect(row<{ allowed: boolean }>(second).allowed).toBe(true);
    expect(row<{ allowed: boolean }>(third).allowed).toBe(false);
  });
});
