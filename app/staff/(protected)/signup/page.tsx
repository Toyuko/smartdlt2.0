import type { Metadata } from "next";
import { QuickSignup } from "@/components/staff/quick-signup";

export const instant = false;
export const metadata: Metadata = { title: "Quick signup", robots: { index: false, follow: false } };

export default function QuickSignupPage() {
  return <QuickSignup />;
}
