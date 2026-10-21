import { Suspense } from "react";
import type { Metadata } from "next";
import { TokenStatus } from "@/components/token-status";

export const metadata: Metadata = {
  title: "Demo verification",
  robots: { index: false, follow: false },
};

export default function VerificationPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <Suspense fallback={<p className="text-sm text-muted">Loading demo verification…</p>}>
        <TokenStatus />
      </Suspense>
    </main>
  );
}
