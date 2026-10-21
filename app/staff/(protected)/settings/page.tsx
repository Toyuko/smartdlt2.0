import { Suspense } from "react";
import type { Metadata } from "next";
import { SettingsPanel } from "@/components/staff/panels";
import { getStaffSession } from "@/lib/auth";

export const instant = false;
export const metadata: Metadata = { title: "Staff settings", robots: { index: false, follow: false } };

async function SettingsBody() {
  const session = await getStaffSession();
  if (session.kind !== "staff") return null;
  return <SettingsPanel displayName={session.displayName} role={session.role} />;
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Loading settings…</p>}>
      <SettingsBody />
    </Suspense>
  );
}
