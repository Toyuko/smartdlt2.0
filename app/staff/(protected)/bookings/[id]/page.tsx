import { Suspense } from "react";
import { BookingDetail } from "@/components/staff/panels";

export const instant = false;

export default function StaffBookingPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading booking…</p>}>
      <StaffBookingDetail params={params} />
    </Suspense>
  );
}

async function StaffBookingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <BookingDetail id={id} />;
}
