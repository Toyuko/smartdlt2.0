import type { BookingStatus } from "@/lib/booking/outcomes";

export type PublicBooking = {
  id: string;
  reference: string;
  status: BookingStatus;
  applicantDisplayName: string;
  vehicleCategory: string | null;
  officeName: string;
  officeNameTh: string;
  province: string;
  provinceTh: string;
  demoLabel: string;
  serviceName: string;
  serviceNameTh: string;
  serviceSlug: string;
  category: string;
  categoryLabel: string;
  categoryLabelTh: string;
  applicantCategory: string | null;
  answers: Record<string, string>;
  startsAt: string;
  endsAt: string;
};

export function toPublicBooking(booking: PublicBooking): PublicBooking {
  return {
    id: booking.id,
    reference: booking.reference,
    status: booking.status,
    applicantDisplayName: booking.applicantDisplayName,
    vehicleCategory: booking.vehicleCategory,
    officeName: booking.officeName,
    officeNameTh: booking.officeNameTh,
    province: booking.province,
    provinceTh: booking.provinceTh,
    demoLabel: booking.demoLabel,
    serviceName: booking.serviceName,
    serviceNameTh: booking.serviceNameTh,
    serviceSlug: booking.serviceSlug,
    category: booking.category,
    categoryLabel: booking.categoryLabel,
    categoryLabelTh: booking.categoryLabelTh,
    applicantCategory: booking.applicantCategory,
    answers: booking.answers,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
  };
}
