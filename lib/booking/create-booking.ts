import { buildVerificationUrl } from "@/lib/booking/codes";
import { inferLicenceClass, snapshotGuidance, validateSelection, type BookingCategory, type SavedGuidance } from "@/lib/booking/categories";
import { toPublicBooking, type PublicBooking } from "@/lib/booking/public-view";
import { generateReference, generateToken, hashToken } from "@/lib/booking/tokens";
import { bookingRequestSchema, fieldErrorsFromZod } from "@/lib/booking/validation";
import { HttpError } from "@/lib/http";
import { bangkokDateParts } from "@/lib/time";

export type ReserveInput = {
  officeId: string;
  serviceId: string;
  timeSlotId: string;
  vehicleCategory: string | null;
  applicantDisplayName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  notes: string | null;
  idempotencyKey: string;
  reference: string;
  tokenHash: string;
  applicantCategory: string | null;
  answers: Record<string, string>;
  documentGuidance: SavedGuidance;
};

export type BookingContext = {
  officeSlug: string;
  officeActive: boolean;
  serviceSlug: string;
  serviceActive: boolean;
  requiresVehicle: boolean;
  category: BookingCategory | null;
};

export type ReserveResult = {
  idempotent: boolean;
  id: string;
  reference: string;
  status: string;
};

export interface BookingWriter {
  consumeRateLimit(bucket: string, keyHash: string, limit: number, windowSeconds: number): Promise<boolean>;
  loadContext(officeId: string, serviceId: string): Promise<BookingContext | null>;
  reserve(input: ReserveInput): Promise<ReserveResult>;
  getPublicById(id: string): Promise<PublicBooking | null>;
}

export async function createDemoBooking(
  writer: BookingWriter,
  input: unknown,
  options: { keyHash: string; origin: string },
) {
  const parsed = bookingRequestSchema.safeParse(input);
  if (!parsed.success) {
    throw new HttpError(400, "validation", "Check the highlighted fields.", fieldErrorsFromZod(parsed.error));
  }

  const allowed = await writer.consumeRateLimit("booking_create", options.keyHash, 8, 60 * 60);
  if (!allowed) {
    throw new HttpError(429, "rate_limited", "Too many demonstration bookings from this network. Try again later.");
  }

  const data = parsed.data;
  const context = await writer.loadContext(data.officeId, data.serviceId);
  if (!context) throw new HttpError(409, "slot_unavailable");
  const decision = validateSelection({
    ...context,
    applicantCategory: data.applicantCategory,
    categorySlug: data.categorySlug,
    vehicleCategory: data.vehicleCategory,
    answers: data.answers,
    today: bangkokDateParts().isoDate,
  });
  if (!decision.ok) {
    throw new HttpError(400, "validation", "Check the highlighted fields.", decision.fieldErrors);
  }
  const documentGuidance = snapshotGuidance(context.category, {
    applicantCategory: data.applicantCategory,
    serviceSlug: context.serviceSlug,
    licenceClass: inferLicenceClass(context.serviceSlug, decision.answers, data.vehicleCategory),
    licenceType: decision.answers.currentLicenceType ?? "",
  });

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const token = generateToken();
    const reference = generateReference();
    try {
      const reserved = await writer.reserve({
        officeId: data.officeId,
        serviceId: data.serviceId,
        timeSlotId: data.timeSlotId,
        vehicleCategory: data.vehicleCategory || null,
        applicantDisplayName: data.applicantDisplayName,
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone || null,
        notes: data.notes || null,
        idempotencyKey: data.idempotencyKey,
        reference,
        tokenHash: hashToken(token),
        applicantCategory: data.applicantCategory,
        answers: decision.answers,
        documentGuidance,
      });
      const booking = await writer.getPublicById(reserved.id);
      if (!booking) throw new HttpError(500, "server_error");
      const publicBooking = toPublicBooking(booking);
      return {
        reference: reserved.reference,
        idempotent: reserved.idempotent,
        token: reserved.idempotent ? null : token,
        verificationUrl: reserved.idempotent ? null : buildVerificationUrl(options.origin, token),
        booking: publicBooking,
      };
    } catch (error) {
      lastError = error;
      if (error instanceof HttpError && error.code === "reference_conflict") continue;
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new HttpError(500, "server_error");
}
