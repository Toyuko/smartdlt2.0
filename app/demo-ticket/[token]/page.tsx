import { Suspense } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { connection } from "next/server";
import QRCode from "qrcode";
import { ElectronicTicket, TicketMissing, TicketUnavailable } from "@/components/booking/electronic-ticket";
import { SetupRequired } from "@/components/language";
import { getStaffSession } from "@/lib/auth";
import { buildVerificationUrl, resolveTicketOrigin } from "@/lib/booking/codes";
import { loadTicketByToken } from "@/lib/booking/ticket";
import { SetupError } from "@/lib/http";

export const instant = false;
export const metadata: Metadata = {
  title: "Electronic Booking Ticket (Demo)",
  robots: { index: false, follow: false },
};

export default function DemoTicketPage({ params }: { params: Promise<{ token: string }> }) {
  return (
    <Suspense fallback={<p className="px-4 py-8 text-sm text-muted">Loading the demo ticket…</p>}>
      <DemoTicketLoader params={params} />
    </Suspense>
  );
}

async function DemoTicketLoader({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  const origin = resolveTicketOrigin(await headers());
  const ticketUrl = origin ? buildVerificationUrl(origin, token) : "";
  try {
    const [result, session] = await Promise.all([
      loadTicketByToken(token),
      getStaffSession().catch(() => ({ kind: "anonymous" as const })),
    ]);
    if (result.state === "unavailable") return <TicketUnavailable />;
    if (result.state !== "ready") return <TicketMissing />;
    let imageSrc = "";
    if (ticketUrl) {
      try {
        imageSrc = await QRCode.toDataURL(ticketUrl, {
          errorCorrectionLevel: "H",
          margin: 2,
          width: 320,
          color: { dark: "#1d1630", light: "#ffffff" },
        });
      } catch {
        imageSrc = "";
      }
    }
    const staff = session.kind === "staff" ? { bookingId: result.booking.id, status: result.booking.status } : null;
    return <ElectronicTicket booking={result.booking} outcome={result.outcome} ticketUrl={ticketUrl} imageSrc={imageSrc} staff={staff} />;
  } catch (error) {
    if (error instanceof SetupError) {
      return (
        <main className="mx-auto w-full max-w-3xl px-4 py-8">
          <SetupRequired />
        </main>
      );
    }
    return <TicketUnavailable />;
  }
}
