import { Suspense } from "react";
import { redirect } from "next/navigation";

export const instant = false;

export default function LegacyBookingPage({ params }: { params: Promise<{ reference: string }> }) {
  return (
    <Suspense fallback={null}>
      <LegacyBookingRedirect params={params} />
    </Suspense>
  );
}

async function LegacyBookingRedirect({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  redirect(`/booking-confirmation/${encodeURIComponent(reference)}`);
  return null;
}
