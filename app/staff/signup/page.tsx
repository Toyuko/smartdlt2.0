import type { Metadata } from "next";
import { QuickSignup } from "@/components/staff/quick-signup";

export const instant = false;
export const metadata: Metadata = { title: "Quick signup" };

export default function QuickSignupPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <QuickSignup />
    </main>
  );
}
