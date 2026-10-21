import { Suspense } from "react";
import { StaffGate } from "@/components/staff/gate";

export const instant = false;

export default function ProtectedStaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading staff session…</p>}>
      <StaffGate>{children}</StaffGate>
    </Suspense>
  );
}
