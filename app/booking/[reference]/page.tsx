import { redirect } from "next/navigation";

export const instant = false;

export default async function LegacyBookingPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  redirect(`/booking-confirmation/${encodeURIComponent(reference)}`);
}
