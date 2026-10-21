import type { Metadata } from "next";
import { LookupForm } from "@/components/lookup-form";

export const metadata: Metadata = { title: "Find a demonstration booking" };

export default function LookupPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <LookupForm />
    </main>
  );
}
