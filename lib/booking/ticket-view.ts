import { categoryBySlug, inferLicenceClass, snapshotGuidance, type SavedGuidance } from "@/lib/booking/categories";
import type { VerificationOutcome } from "@/lib/booking/outcomes";
import type { PublicBooking } from "@/lib/booking/public-view";
import { vehicleCategorySeed } from "@/lib/demo-catalog";
import { formatBookingDate, formatSlotRange } from "@/lib/time";

export const TICKET_STATUS: Record<VerificationOutcome, string> = {
  valid: "Valid demo record — not an official DLT confirmation.",
  cancelled: "Cancelled — demo record.",
  already_checked_in: "Already checked in — demo record.",
  completed: "Completed — demo record.",
  expired: "Expired — demo record.",
  invalid: "Demo booking not found.",
  not_found: "Demo booking not found.",
};

export const DATABASE_RETRY = "The demonstration database is unavailable. Retry in a moment.";

export function guidanceForBooking(
  booking: Pick<PublicBooking, "guidance" | "category" | "applicantCategory" | "serviceSlug" | "answers" | "vehicleCategory">,
): SavedGuidance {
  if (booking.guidance && booking.guidance.items.length > 0) return booking.guidance;
  return snapshotGuidance(categoryBySlug(booking.category) ?? null, {
    applicantCategory: booking.applicantCategory ?? "",
    serviceSlug: booking.serviceSlug,
    licenceClass: inferLicenceClass(booking.serviceSlug, booking.answers, booking.vehicleCategory ?? ""),
    licenceType: booking.answers.currentLicenceType ?? "",
  });
}

export function vehicleLabel(
  booking: Pick<PublicBooking, "vehicleCategory" | "serviceSlug" | "answers">,
  locale: "en" | "th",
) {
  if (booking.answers.foreignLicenceClass === "both") {
    return locale === "th" ? "รถยนต์และรถจักรยานยนต์" : "Car and motorcycle";
  }
  const slug =
    booking.vehicleCategory || inferLicenceClass(booking.serviceSlug, booking.answers, booking.vehicleCategory ?? "");
  const known = vehicleCategorySeed.find((item) => item.slug === slug);
  if (!known) return "";
  return locale === "th" ? known.name_th : known.name;
}

export function presentTicket(booking: PublicBooking, locale: "en" | "th") {
  return {
    date: formatBookingDate(booking.startsAt),
    round: formatSlotRange(booking.startsAt, booking.endsAt),
    category: locale === "th" ? booking.categoryLabelTh : booking.categoryLabel,
    service: locale === "th" ? booking.serviceNameTh : booking.serviceName,
    office: locale === "th" ? booking.officeNameTh : booking.officeName,
    province: locale === "th" ? booking.provinceTh : booking.province,
    vehicle: vehicleLabel(booking, locale),
    vehicleEn: vehicleLabel(booking, "en"),
    vehicleTh: vehicleLabel(booking, "th"),
    officeEn: booking.officeName,
    officeTh: booking.officeNameTh,
    provinceEn: booking.province,
    provinceTh: booking.provinceTh,
    categoryEn: booking.categoryLabel,
    categoryTh: booking.categoryLabelTh,
    serviceEn: booking.serviceName,
    serviceTh: booking.serviceNameTh,
    name: booking.applicantDisplayName,
    reference: booking.reference,
    guidance: guidanceForBooking(booking),
    demoLabel: booking.demoLabel,
  };
}
