import type { Metadata } from "next";
import { BookingList } from "@/components/staff/panels";

export const instant = false;
export const metadata: Metadata = { title: "Staff bookings", robots: { index: false, follow: false } };

export default function StaffBookingsPage() {
  return <BookingList />;
}
