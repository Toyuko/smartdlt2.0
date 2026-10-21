import { Suspense } from "react";
import type { Metadata } from "next";
import { BookingConfirmation } from "@/components/booking/confirmation";

export const metadata: Metadata = { title: "Demonstration booking", robots: { index: false, follow: false } };

export default function BookingPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <Suspense fallback={<p className="text-sm text-muted">Loading confirmation…</p>}>
        <BookingConfirmation />
      </Suspense>
    </main>
  );
}
