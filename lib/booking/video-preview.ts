import "server-only";

import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { categoryBySlug } from "@/lib/booking/categories";
import type { BookingContext, BookingWriter, ReserveInput, ReserveResult } from "@/lib/booking/create-booking";
import type { PublicBooking } from "@/lib/booking/public-view";
import { HttpError } from "@/lib/http";
import { createAnonClient } from "@/lib/supabase/clients";

const filePath = "/tmp/smartdlt-video-bookings.json";

type SavedBooking = {
  id: string;
  tokenHash: string;
  idempotencyKey: string;
  booking: PublicBooking;
};

export function videoPreviewEnabled() {
  return process.env.BOOKING_VIDEO_PREVIEW === "1" && !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

function readAll(): SavedBooking[] {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as { bookings?: SavedBooking[] };
    return parsed.bookings ?? [];
  } catch {
    return [];
  }
}

function writeAll(bookings: SavedBooking[]) {
  writeFileSync(filePath, JSON.stringify({ bookings }));
}

export function findVideoPreviewBooking(query: { id?: string; reference?: string; tokenHash?: string }) {
  const match = readAll().find((item) => {
    if (query.id) return item.id === query.id;
    if (query.reference) return item.booking.reference === query.reference;
    if (query.tokenHash) return item.tokenHash === query.tokenHash;
    return false;
  });
  return match?.booking ?? null;
}

export function createVideoPreviewWriter(): BookingWriter {
  return {
    async consumeRateLimit() {
      return true;
    },
    async loadContext(officeId, serviceId): Promise<BookingContext | null> {
      const anon = createAnonClient();
      const office = await anon.from("offices").select("slug, active").eq("id", officeId).maybeSingle();
      const service = await anon.from("services").select("slug, active, requires_vehicle, category").eq("id", serviceId).maybeSingle();
      if (office.error || service.error || !office.data || !service.data) return null;
      return {
        officeSlug: office.data.slug,
        officeActive: office.data.active,
        serviceSlug: service.data.slug,
        serviceActive: service.data.active,
        requiresVehicle: service.data.requires_vehicle,
        category: categoryBySlug(service.data.category) ?? null,
      };
    },
    async reserve(input: ReserveInput): Promise<ReserveResult> {
      const existing = readAll().find((item) => item.idempotencyKey === input.idempotencyKey);
      if (existing) {
        return { idempotent: true, id: existing.id, reference: existing.booking.reference, status: existing.booking.status };
      }
      const anon = createAnonClient();
      const [office, service, slot] = await Promise.all([
        anon.from("offices").select("name, name_th, province, province_th, demo_label").eq("id", input.officeId).maybeSingle(),
        anon.from("services").select("name, name_th, category, category_th, slug").eq("id", input.serviceId).maybeSingle(),
        anon.from("time_slots").select("starts_at, ends_at").eq("id", input.timeSlotId).maybeSingle(),
      ]);
      if (office.error || service.error || slot.error || !office.data || !service.data || !slot.data) {
        throw new HttpError(409, "slot_unavailable");
      }
      const category = categoryBySlug(service.data.category);
      const id = randomUUID();
      const booking: PublicBooking = {
        id,
        reference: input.reference,
        status: "confirmed",
        applicantDisplayName: input.applicantDisplayName,
        vehicleCategory: input.vehicleCategory,
        officeName: office.data.name,
        officeNameTh: office.data.name_th,
        province: office.data.province,
        provinceTh: office.data.province_th,
        demoLabel: office.data.demo_label,
        serviceName: service.data.name,
        serviceNameTh: service.data.name_th,
        serviceSlug: service.data.slug,
        category: service.data.category,
        categoryLabel: category?.name ?? service.data.category,
        categoryLabelTh: category?.nameTh ?? service.data.category_th,
        applicantCategory: input.applicantCategory,
        answers: input.answers,
        guidance: input.documentGuidance,
        startsAt: slot.data.starts_at,
        endsAt: slot.data.ends_at,
      };
      const bookings = readAll();
      bookings.push({ id, tokenHash: input.tokenHash, idempotencyKey: input.idempotencyKey, booking });
      writeAll(bookings);
      return { idempotent: false, id, reference: input.reference, status: "confirmed" };
    },
    async getPublicById(id) {
      return findVideoPreviewBooking({ id });
    },
  };
}
