import type { Metadata } from "next";
import { ServiceDirectory } from "@/components/service-directory";

export const metadata: Metadata = { title: "Demonstration services" };

export default function ServicesPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8">
      <ServiceDirectory />
    </main>
  );
}
