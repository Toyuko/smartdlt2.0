import { describe, expect, it } from "vitest";
import { buildVerificationUrl, isReference, parseScanPayload } from "@/lib/booking/codes";
import { createDemoBooking, type BookingWriter } from "@/lib/booking/create-booking";
import { decideVerificationOutcome } from "@/lib/booking/outcomes";
import { toPublicBooking, type PublicBooking } from "@/lib/booking/public-view";
import { generateReference, generateToken, hashToken } from "@/lib/booking/token-core";
import { bookingRequestSchema } from "@/lib/booking/validation";
import { HttpError } from "@/lib/http";
import { formatLongDate } from "@/lib/time";
import { DEMO_NOTICE, DEMO_QR_NOTICE } from "@/lib/demo-notice";

const booking: PublicBooking = {
  id: "11111111-1111-4111-8111-111111111111",
  reference: "VD-TEST-BOOK",
  status: "confirmed",
  applicantDisplayName: "Sample Visitor",
  vehicleCategory: "car",
  officeName: "Violet Desk Riverside Demo",
  officeNameTh: "ไวโอเล็ตเดสก์",
  province: "Chiang Mai",
  provinceTh: "เชียงใหม่",
  demoLabel: "Demo location — not an official DLT office",
  serviceName: "Renewal demonstration — car",
  serviceNameTh: "สาธิตการต่ออายุ",
  category: "renewal",
  startsAt: "2026-10-29T01:00:00.000Z",
  endsAt: "2026-10-29T02:00:00.000Z",
};

const request = {
  officeId: "11111111-1111-4111-8111-111111111111",
  serviceId: "22222222-2222-4222-8222-222222222222",
  vehicleCategory: "car",
  applicantDisplayName: "Sample Visitor",
  contactEmail: "visitor@example.com",
  contactPhone: "",
  notes: "",
  timeSlotId: "33333333-3333-4333-8333-333333333333",
  acceptDisclaimer: true,
  idempotencyKey: "44444444-4444-4444-8444-444444444444",
};

function writer(overrides: Partial<BookingWriter> = {}): BookingWriter {
  return {
    consumeRateLimit: async () => true,
    reserve: async () => ({ idempotent: false, id: booking.id, reference: booking.reference, status: "confirmed" }),
    getPublicById: async () => booking,
    ...overrides,
  };
}

describe("demo booking rules", () => {
  it("keeps the required English demonstration wording", () => {
    expect(DEMO_NOTICE).toBe(
      "DEMONSTRATION SYSTEM — NOT AN OFFICIAL DLT SERVICE. Appointments and QR codes are for demonstration and testing only and are not valid for government services.",
    );
    expect(DEMO_QR_NOTICE).toBe("DEMO QR — NOT VALID FOR OFFICIAL DLT CHECK-IN.");
  });

  it("rejects identity-number shaped input and missing consent", () => {
    const parsed = bookingRequestSchema.safeParse({
      ...request,
      applicantDisplayName: "1103700123456",
      acceptDisclaimer: false,
    });
    expect(parsed.success).toBe(false);
  });

  it("formats 29 October 2026 in the Buddhist era for Thai", () => {
    expect(formatLongDate("2026-10-29T01:00:00.000Z", "th")).toContain("2569");
    expect(formatLongDate("2026-10-29T01:00:00.000Z", "en")).toContain("2026");
  });

  it("puts only an opaque verification URL in the QR payload", async () => {
    const result = await createDemoBooking(writer(), request, { keyHash: "ip", origin: "https://demo.example" });
    expect(result.verificationUrl).toMatch(/^https:\/\/demo\.example\/v\/[^/?#]+$/);
    expect(result.verificationUrl).not.toContain("visitor@example.com");
    expect(result.verificationUrl).not.toContain("Sample");
    expect(result.booking).not.toHaveProperty("contactEmail");
    expect(toPublicBooking(booking)).not.toHaveProperty("notes");
  });

  it("does not return a second token for an idempotent replay", async () => {
    const result = await createDemoBooking(
      writer({ reserve: async () => ({ idempotent: true, id: booking.id, reference: "VD-TEST-BOOK", status: "confirmed" }) }),
      request,
      { keyHash: "ip", origin: "https://demo.example" },
    );
    expect(result.token).toBeNull();
    expect(result.verificationUrl).toBeNull();
  });

  it("rate limits booking creation", async () => {
    await expect(
      createDemoBooking(writer({ consumeRateLimit: async () => false }), request, { keyHash: "ip", origin: "https://demo.example" }),
    ).rejects.toMatchObject({ status: 429, code: "rate_limited" });
  });

  it("creates unguessable references and token hashes", () => {
    const token = generateToken();
    expect(token.length).toBeGreaterThanOrEqual(32);
    expect(hashToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(hashToken(token)).not.toBe(token);
    expect(isReference(generateReference())).toBe(true);
  });

  it("accepts only this application's verification URL", () => {
    const token = "a".repeat(32);
    const url = buildVerificationUrl("https://demo.example", token);
    expect(parseScanPayload(url, ["https://demo.example"])).toEqual({ type: "token", token });
    expect(parseScanPayload("https://evil.example/v/" + token, ["https://demo.example"]).type).toBe("rejected");
    expect(parseScanPayload("VD-SAMP-CONF", ["https://demo.example"])).toEqual({ type: "reference", reference: "VD-SAMP-CONF" });
    expect(parseScanPayload(`${url}?email=a@example.com`, ["https://demo.example"]).type).toBe("rejected");
  });

  it("describes appointment state without treating a finished visit as still valid", () => {
    expect(decideVerificationOutcome({ status: "confirmed", endsAt: "2999-01-01T00:00:00.000Z", now: new Date("2026-01-01") })).toBe("valid");
    expect(decideVerificationOutcome({ status: "confirmed", endsAt: "2020-01-01T00:00:00.000Z", now: new Date("2026-01-01") })).toBe("expired");
    expect(decideVerificationOutcome({ status: "checked_in", endsAt: "2999-01-01T00:00:00.000Z" })).toBe("already_checked_in");
    expect(decideVerificationOutcome({ status: "cancelled", endsAt: "2999-01-01T00:00:00.000Z" })).toBe("cancelled");
    expect(decideVerificationOutcome({ status: "completed", endsAt: "2999-01-01T00:00:00.000Z" })).toBe("completed");
  });

  it("maps validation failures to field codes", async () => {
    await expect(createDemoBooking(writer(), { ...request, applicantDisplayName: "A" }, { keyHash: "ip", origin: "https://demo.example" })).rejects.toBeInstanceOf(HttpError);
  });
});
