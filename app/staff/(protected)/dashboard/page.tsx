import type { Metadata } from "next";
import { DashboardPanel } from "@/components/staff/panels";

export const instant = false;
export const metadata: Metadata = { title: "Staff dashboard", robots: { index: false, follow: false } };

export default function DashboardPage() {
  return <DashboardPanel />;
}
