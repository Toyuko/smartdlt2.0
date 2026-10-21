import { Suspense } from "react";
import type { Metadata } from "next";
import { connection } from "next/server";
import { ConfirmationScreen } from "@/components/booking/confirmation";
import { TicketMissing, TicketUnavailable } from "@/components/booking/electronic-ticket";
import { SetupRequired } from "@/components/language";
import { loadTicketByReference } from "@/lib/booking/ticket";
import { SetupError } from "@/lib/http";

export const instant = false;
export const metadata: Metadata = {
  title: "Booking information",
  robots: { index: false, follow: false },
};

export default function BookingConfirmationPage({ params }: { params: Promise<{ reference: string }> }) {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading booking information…</p>}>
      <ConfirmationLoader params={params} />
    </Suspense>
  );
}

async function ConfirmationLoader({ params }: { params: Promise<{ reference: string }> }) {
  await connection();
  const { reference } = await params;
  try {
    const result = await loadTicketByReference(reference);
    if (result.state === "unavailable") return <TicketUnavailable />;
    if (result.state !== "ready") return <TicketMissing />;
    return <ConfirmationScreen booking={result.booking} outcome={result.outcome} />;
  } catch (error) {
    if (error instanceof SetupError) {
      return (
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          <SetupRequired />
        </main>
      );
    }
    return <TicketUnavailable />;
  }
}
