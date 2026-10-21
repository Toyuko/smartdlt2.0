import { Suspense } from "react";
import type { Metadata } from "next";
import { BookingWizard } from "@/components/booking/booking-wizard";

export const metadata: Metadata = { title: "Book a demonstration" };

export default function BookPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <Suspense fallback={<p className="text-sm text-muted">Loading the booking desk…</p>}>
        <BookingWizard />
      </Suspense>
    </main>
  );
}
