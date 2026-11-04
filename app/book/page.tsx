import { Suspense } from "react";
import type { Metadata } from "next";
import { BookingWizard } from "@/components/booking/booking-wizard";

export const metadata: Metadata = { title: "Book a demonstration" };

export default function BookPage() {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading the booking desk…</p>}>
      <BookingWizard />
    </Suspense>
  );
}
