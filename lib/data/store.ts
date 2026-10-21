import "server-only";
import { categoryBySlug, categoryFromRow, parseSavedGuidance, stringRecord } from "@/lib/booking/categories";
import type { BookingCategory } from "@/lib/booking/categories";
import { decideVerificationOutcome, type BookingStatus, type VerificationOutcome } from "@/lib/booking/outcomes";
import type { BookingContext, BookingWriter, ReserveInput, ReserveResult } from "@/lib/booking/create-booking";
import type { PublicBooking } from "@/lib/booking/public-view";
import { hashToken } from "@/lib/booking/tokens";
import { HttpError, httpErrorFromDb, readDbCode } from "@/lib/http";
import { monthRangeBangkok } from "@/lib/time";
import { createAdminClient, createAnonClient } from "@/lib/supabase/clients";

type QueryError = { message?: string; details?: string } | null;

export type DocumentGuidance = {
  summaryEn: string;
  summaryTh: string;
  items: { en: string; th: string }[];
};

export type CatalogOffice = {
  id: string;
  slug: string;
  name: string;
  nameTh: string;
  province: string;
  provinceTh: string;
  demoLabel: string;
};

export type CatalogService = {
  id: string;
  slug: string;
  name: string;
  nameTh: string;
  category: string;
  categoryTh: string;
  requiresVehicle: boolean;
  documentGuidance: DocumentGuidance;
};

export type CatalogVehicle = { slug: string; name: string; nameTh: string };

export type CatalogCategory = BookingCategory;

export type StaffBooking = PublicBooking & {
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  createdAt: string;
  checkedInAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  officeId: string;
  serviceId: string;
  timeSlotId: string;
};

export type AuditEntry = {
  id: string;
  action: string;
  createdAt: string;
  metadata: { from?: string; to?: string };
};

const PUBLIC_COLUMNS = `
  id, reference, status, applicant_display_name, vehicle_category, applicant_category, answers, document_guidance,
  offices!bookings_office_id_fkey ( name, name_th, province, province_th, demo_label ),
  services!bookings_service_id_fkey ( name, name_th, category, category_th, slug ),
  time_slots!bookings_time_slot_id_fkey ( starts_at, ends_at )
`;

const STAFF_COLUMNS = `
  id, reference, status, applicant_display_name, vehicle_category, applicant_category, answers, document_guidance,
  contact_email, contact_phone, notes, created_at, checked_in_at, completed_at, cancelled_at,
  office_id, service_id, time_slot_id,
  offices!bookings_office_id_fkey ( name, name_th, province, province_th, demo_label ),
  services!bookings_service_id_fkey ( name, name_th, category, category_th, slug ),
  time_slots!bookings_time_slot_id_fkey ( starts_at, ends_at, capacity )
`;

function fail(error: QueryError, code: string): never {
  if (readDbCode(error)) throw httpErrorFromDb(error);
  if (process.env.NODE_ENV !== "production") console.error(code);
  throw new HttpError(502, code);
}

function asOne<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function parseGuidance(value: unknown): DocumentGuidance {
  const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const items = Array.isArray(record.items)
    ? record.items.flatMap((item) => {
        if (!item || typeof item !== "object") return [];
        const entry = item as Record<string, unknown>;
        return [{ en: String(entry.en ?? ""), th: String(entry.th ?? "") }];
      })
    : [];
  return {
    summaryEn: String(record.summary_en ?? ""),
    summaryTh: String(record.summary_th ?? ""),
    items,
  };
}

function mapPublic(row: Record<string, unknown>): PublicBooking {
  const office = asOne(row.offices as PublicBooking extends never ? never : Record<string, string> | Record<string, string>[] | null);
  const service = asOne(row.services as Record<string, string> | Record<string, string>[] | null);
  const slot = asOne(row.time_slots as Record<string, string> | Record<string, string>[] | null);
  const status = String(row.status);
  if (!office || !service || !slot || !isStatus(status)) throw new HttpError(500, "server_error");
  return {
    id: String(row.id),
    reference: String(row.reference),
    status,
    applicantDisplayName: String(row.applicant_display_name),
    vehicleCategory: row.vehicle_category ? String(row.vehicle_category) : null,
    officeName: office.name,
    officeNameTh: office.name_th,
    province: office.province,
    provinceTh: office.province_th,
    demoLabel: office.demo_label,
    serviceName: service.name,
    serviceNameTh: service.name_th,
    serviceSlug: String(service.slug ?? ""),
    category: service.category,
    categoryLabel: categoryBySlug(service.category)?.name ?? service.category,
    categoryLabelTh: categoryBySlug(service.category)?.nameTh ?? String(service.category_th ?? service.category),
    applicantCategory: row.applicant_category ? String(row.applicant_category) : null,
    answers: stringRecord(row.answers),
    guidance: parseSavedGuidance(row.document_guidance),
    startsAt: slot.starts_at,
    endsAt: slot.ends_at,
  };
}

function isStatus(value: string): value is BookingStatus {
  return value === "confirmed" || value === "checked_in" || value === "completed" || value === "cancelled";
}

function mapStaff(row: Record<string, unknown>): StaffBooking {
  return {
    ...mapPublic(row),
    contactEmail: row.contact_email ? String(row.contact_email) : null,
    contactPhone: row.contact_phone ? String(row.contact_phone) : null,
    notes: row.notes ? String(row.notes) : null,
    createdAt: String(row.created_at),
    checkedInAt: row.checked_in_at ? String(row.checked_in_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    cancelledAt: row.cancelled_at ? String(row.cancelled_at) : null,
    officeId: String(row.office_id),
    serviceId: String(row.service_id),
    timeSlotId: String(row.time_slot_id),
  };
}

export async function getCatalog() {
  const anon = createAnonClient();
  const [offices, services, vehicles, categories] = await Promise.all([
    anon.from("offices").select("id, slug, name, name_th, province, province_th, demo_label").eq("active", true).order("name"),
    anon
      .from("services")
      .select("id, slug, name, name_th, category, category_th, requires_vehicle, document_guidance, sort_order")
      .eq("active", true)
      .order("sort_order"),
    anon.from("vehicle_categories").select("slug, name, name_th, sort_order").eq("active", true).order("sort_order"),
    anon.from("booking_categories").select("*").eq("active", true).order("sort_order"),
  ]);
  if (offices.error) fail(offices.error, "catalog_unavailable");
  if (services.error) fail(services.error, "catalog_unavailable");
  if (vehicles.error) fail(vehicles.error, "catalog_unavailable");
  if (categories.error) fail(categories.error, "catalog_unavailable");
  return {
    offices: (offices.data ?? []).map((office) => ({
      id: office.id,
      slug: office.slug,
      name: office.name,
      nameTh: office.name_th,
      province: office.province,
      provinceTh: office.province_th,
      demoLabel: office.demo_label,
    })) satisfies CatalogOffice[],
    services: (services.data ?? []).map((service) => ({
      id: service.id,
      slug: service.slug,
      name: service.name,
      nameTh: service.name_th,
      category: service.category,
      categoryTh: service.category_th,
      requiresVehicle: service.requires_vehicle,
      documentGuidance: parseGuidance(service.document_guidance),
    })) satisfies CatalogService[],
    vehicles: (vehicles.data ?? []).map((vehicle) => ({
      slug: vehicle.slug,
      name: vehicle.name,
      nameTh: vehicle.name_th,
    })) satisfies CatalogVehicle[],
    categories: (categories.data ?? []).flatMap((row) => {
      const category = categoryFromRow(row as Record<string, unknown>);
      return category ? [category] : [];
    }) satisfies CatalogCategory[],
  };
}

export async function getAvailability(officeId: string, serviceId: string, month: string) {
  const { start, end } = monthRangeBangkok(month);
  const anon = createAnonClient();
  const { data, error } = await anon.rpc("list_slot_availability", {
    p_office_id: officeId,
    p_service_id: serviceId,
    p_from: start.toISOString(),
    p_to: end.toISOString(),
  });
  if (error) fail(error, "availability_unavailable");
  return (data ?? []) as { id: string; starts_at: string; ends_at: string; capacity: number; remaining: number }[];
}

export function createSupabaseBookingWriter(): BookingWriter {
  return {
    async consumeRateLimit(bucket, keyHash, limit, windowSeconds) {
      const admin = createAdminClient();
      const { data, error } = await admin.rpc("consume_rate_limit", {
        p_bucket: bucket,
        p_key_hash: keyHash,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      });
      if (error) fail(error, "rate_limit_unavailable");
      return Boolean(data);
    },
    async loadContext(officeId, serviceId): Promise<BookingContext | null> {
      const admin = createAdminClient();
      const office = await admin.from("offices").select("slug, active").eq("id", officeId).maybeSingle();
      const service = await admin.from("services").select("slug, active, requires_vehicle, category").eq("id", serviceId).maybeSingle();
      if (office.error) fail(office.error, "slot_unavailable");
      if (service.error) fail(service.error, "slot_unavailable");
      if (!office.data || !service.data) return null;
      const category = await admin.from("booking_categories").select("*").eq("slug", service.data.category).maybeSingle();
      if (category.error) fail(category.error, "slot_unavailable");
      return {
        officeSlug: office.data.slug,
        officeActive: office.data.active,
        serviceSlug: service.data.slug,
        serviceActive: service.data.active,
        requiresVehicle: service.data.requires_vehicle,
        category: category.data ? categoryFromRow(category.data as Record<string, unknown>) : null,
      };
    },
    async reserve(input: ReserveInput): Promise<ReserveResult> {
      const admin = createAdminClient();
      const { data, error } = await admin.rpc("reserve_demo_booking", {
        p_office_id: input.officeId,
        p_service_id: input.serviceId,
        p_time_slot_id: input.timeSlotId,
        p_vehicle_category: input.vehicleCategory,
        p_applicant_display_name: input.applicantDisplayName,
        p_contact_email: input.contactEmail,
        p_contact_phone: input.contactPhone,
        p_notes: input.notes,
        p_idempotency_key: input.idempotencyKey,
        p_reference: input.reference,
        p_token_hash: input.tokenHash,
        p_applicant_category: input.applicantCategory,
        p_answers: input.answers,
        p_document_guidance: input.documentGuidance,
      });
      if (error) fail(error, "reserve_failed");
      const result = data as ReserveResult;
      return result;
    },
    async getPublicById(id) {
      const admin = createAdminClient();
      const { data, error } = await admin.from("bookings").select(PUBLIC_COLUMNS).eq("id", id).maybeSingle();
      if (error) fail(error, "booking_unavailable");
      return data ? mapPublic(data as unknown as Record<string, unknown>) : null;
    },
  };
}

export async function getPublicByReference(reference: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("bookings").select(PUBLIC_COLUMNS).eq("reference", reference).maybeSingle();
  if (error) fail(error, "booking_unavailable");
  return data ? mapPublic(data as unknown as Record<string, unknown>) : null;
}

export async function getPublicByTokenHash(tokenHash: string) {
  if (!/^[a-f0-9]{64}$/.test(tokenHash)) return null;
  const admin = createAdminClient();
  const { data, error } = await admin.from("bookings").select(PUBLIC_COLUMNS).eq("verification_token_hash", tokenHash).maybeSingle();
  if (error) fail(error, "booking_unavailable");
  return data ? mapPublic(data as unknown as Record<string, unknown>) : null;
}

export async function inspectDemoBooking(input: { token?: string; reference?: string; keyHash: string; bucket: string }) {
  const writer = createSupabaseBookingWriter();
  const allowed = await writer.consumeRateLimit(input.bucket, input.keyHash, 30, 10 * 60);
  if (!allowed) throw new HttpError(429, "rate_limited", "Too many lookups. Try again later.");

  const admin = createAdminClient();
  let query = admin.from("bookings").select(PUBLIC_COLUMNS);
  if (input.token) query = query.eq("verification_token_hash", hashToken(input.token));
  else if (input.reference) query = query.eq("reference", input.reference);
  else return { outcome: "invalid" as const, booking: null };

  const { data, error } = await query.maybeSingle();
  if (error) fail(error, "booking_unavailable");
  if (!data) {
    return { outcome: (input.token ? "invalid" : "not_found") as VerificationOutcome, booking: null };
  }
  const booking = mapPublic(data as unknown as Record<string, unknown>);
  return { outcome: decideVerificationOutcome(booking), booking };
}

export async function staffSummary(staffUserId: string) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("staff_dashboard_counts", { p_staff_user_id: staffUserId });
  if (error) fail(error, "summary_unavailable");
  return data as {
    today: number;
    week: number;
    upcoming: number;
    cancelled: number;
    checked_in: number;
    completed: number;
  };
}

export async function staffListBookings(filters: {
  reference?: string;
  officeId?: string;
  serviceId?: string;
  status?: string;
  date?: string;
}) {
  const admin = createAdminClient();
  let query = admin.from("bookings").select(STAFF_COLUMNS).order("created_at", { ascending: false }).limit(100);
  if (filters.reference) query = query.eq("reference", filters.reference.toUpperCase());
  if (filters.officeId) query = query.eq("office_id", filters.officeId);
  if (filters.serviceId) query = query.eq("service_id", filters.serviceId);
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.date) {
    const start = new Date(`${filters.date}T00:00:00+07:00`);
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
    const slots = await admin.from("time_slots").select("id").gte("starts_at", start.toISOString()).lt("starts_at", end.toISOString());
    if (slots.error) fail(slots.error, "booking_unavailable");
    const ids = (slots.data ?? []).map((slot) => slot.id);
    if (ids.length === 0) return [] as StaffBooking[];
    query = query.in("time_slot_id", ids);
  }
  const { data, error } = await query;
  if (error) fail(error, "booking_unavailable");
  return (data ?? []).map((row) => mapStaff(row as unknown as Record<string, unknown>));
}

export async function staffGetBooking(id: string) {
  const admin = createAdminClient();
  const booking = await admin.from("bookings").select(STAFF_COLUMNS).eq("id", id).maybeSingle();
  if (booking.error) fail(booking.error, "booking_unavailable");
  if (!booking.data) return null;
  const audit = await admin
    .from("audit_logs")
    .select("id, action, metadata, created_at")
    .eq("booking_id", id)
    .order("created_at", { ascending: true });
  if (audit.error) fail(audit.error, "booking_unavailable");
  return {
    booking: mapStaff(booking.data as unknown as Record<string, unknown>),
    audit: (audit.data ?? []).map((entry) => ({
      id: entry.id,
      action: entry.action,
      createdAt: entry.created_at,
      metadata: (entry.metadata ?? {}) as AuditEntry["metadata"],
    })),
  };
}

export async function staffTransition(bookingId: string, staffUserId: string, action: "check_in" | "complete" | "cancel") {
  const admin = createAdminClient();
  const { error } = await admin.rpc("transition_booking", {
    p_booking_id: bookingId,
    p_staff_user_id: staffUserId,
    p_action: action,
  });
  if (error) fail(error, "transition_failed");
  return staffGetBooking(bookingId);
}
