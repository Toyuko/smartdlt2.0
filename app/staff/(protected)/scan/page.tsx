import type { Metadata } from "next";
import { Scanner } from "@/components/staff/panels";

export const instant = false;
export const metadata: Metadata = { title: "Scan a demo QR", robots: { index: false, follow: false } };

export default function ScanPage() {
  return <Scanner />;
}
