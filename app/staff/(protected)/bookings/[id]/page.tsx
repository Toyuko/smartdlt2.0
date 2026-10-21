import { Suspense } from "react";
import { StaffBookingDetail } from "./detail-client";

export const instant = false;

export default function StaffBookingPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading booking…</p>}>
      <StaffBookingDetail />
    </Suspense>
  );
}
