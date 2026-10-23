import { categoryBySlug, inferLicenceClass, snapshotGuidance, type SavedGuidance } from "@/lib/booking/categories";
import type { VerificationOutcome } from "@/lib/booking/outcomes";
import type { PublicBooking } from "@/lib/booking/public-view";
import { vehicleCategorySeed } from "@/lib/demo-catalog";
import { formatAppointmentDate, formatAppointmentRange, formatBookingDate, formatSlipRound, formatSlotRange } from "@/lib/time";

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

export const TICKET_STATUS_TH: Record<VerificationOutcome, string> = {
  valid: "รายการสาธิตที่ถูกต้อง — ไม่ใช่การยืนยันของกรมการขนส่งทางบก",
  cancelled: "ยกเลิกแล้ว — รายการสาธิต",
  already_checked_in: "เช็กอินแล้ว — รายการสาธิต",
  completed: "เสร็จสิ้น — รายการสาธิต",
  expired: "หมดอายุ — รายการสาธิต",
  invalid: "ไม่พบการจองสาธิต",
  not_found: "ไม่พบการจองสาธิต",
};

export const DATABASE_RETRY_TH = "ฐานข้อมูลสาธิตไม่พร้อมใช้งาน โปรดลองอีกครั้งในอีกสักครู่";

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

export function applicantShort(category: string | null) {
  if (category === "foreign") return "ชาวต่างชาติ";
  if (category === "thai") return "บุคคลทั่วไป";
  return "";
}

function splitDisplayName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "—", last: "—" };
  if (parts.length === 1) return { first: parts[0], last: "—" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

export function presentTicket(booking: PublicBooking, locale: "en" | "th") {
  const names = splitDisplayName(booking.applicantDisplayName);
  const applicant = applicantShort(booking.applicantCategory);
  const categoryUpper = (locale === "th" ? booking.categoryLabelTh : booking.categoryLabel).toUpperCase();
  return {
    date: formatBookingDate(booking.startsAt),
    round: formatSlotRange(booking.startsAt, booking.endsAt),
    slipRound: formatSlipRound(booking.startsAt, booking.endsAt),
    ticketDate: formatAppointmentDate(booking.startsAt),
    ticketTime: formatAppointmentRange(booking.startsAt, booking.endsAt),
    applicantShort: applicant,
    categoryUpper,
    bookingType: applicant ? `${applicant}: ${booking.categoryLabel.toUpperCase()}` : booking.categoryLabel.toUpperCase(),
    firstName: names.first,
    lastName: names.last,
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
