import { Suspense } from "react";
import type { Metadata } from "next";
import { LoginForm } from "@/components/staff/panels";

export const metadata: Metadata = { title: "Staff sign in", robots: { index: false, follow: false } };

export default function StaffLoginPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <Suspense fallback={<p className="text-sm text-muted">Loading sign in…</p>}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
