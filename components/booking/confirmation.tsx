"use client";

import { useEffect, useState } from "react";
import { GuidancePanel } from "@/components/booking/document-guidance";
import { QrCard } from "@/components/booking/qr-card";
import type { VerificationOutcome } from "@/lib/booking/outcomes";
import { presentTicket } from "@/lib/booking/ticket-view";
import { DEMO_NOTICE } from "@/lib/demo-notice";
import { th } from "@/lib/i18n/dictionary";
import type { PublicBooking } from "@/lib/booking/public-view";

export function ConfirmationScreen({
  booking,
  initialTicketUrl = "",
}: {
  booking: PublicBooking;
  outcome: VerificationOutcome;
  initialTicketUrl?: string;
}) {
  const t = th;
  const [ticketUrl, setTicketUrl] = useState(initialTicketUrl);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const view = presentTicket(booking, "th");

  useEffect(() => {
    if (initialTicketUrl) return;
    const stored = window.sessionStorage.getItem(`vd-verify-url:${booking.reference}`) ?? "";
    // The raw token is not stored. The one-time ticket URL is kept only for this browser session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTicketUrl(stored);
  }, [booking.reference, initialTicketUrl]);

  return (
    <div lang="th" className="confirmation-page min-h-dvh bg-[linear-gradient(180deg,#f3e6fb_0%,#f7f1fb_24%,#f6f6f8_58%,#f5f5f7_100%)] px-4 pb-16 pt-5">
      <div data-testid="confirmation-layout" className="mx-auto w-full max-w-md overflow-x-hidden">
        <p className="print-disclaimer slip-legal" data-testid="print-disclaimer">
          {DEMO_NOTICE}
        </p>

        <section className="print-card rounded-[22px] bg-white px-5 pb-5 pt-4 shadow-[0_10px_28px_rgba(80,40,140,0.08)]">
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-2.5 gap-y-1.5">
            <p className="text-[12px] leading-4 text-[#9a9aa4]">{t.confirm.bookingDate}</p>
            <h1 className="px-1 text-center text-[12px] font-normal leading-4 text-[#9a9aa4]">{t.confirm.pageTitle}</h1>
            <p className="text-right text-[12px] leading-4 text-[#9a9aa4]">{t.confirm.round}</p>
            <p className="text-[15px] font-bold tabular-nums leading-5 text-[#171717]">{view.slipDate}</p>
            <SlotArrow />
            <p className="text-right text-[15px] font-bold tabular-nums leading-5 text-[#171717]">{view.slipRound}</p>
          </div>
          <p className="mt-4 text-[14px] font-semibold leading-6 text-[#6d28d9]">{view.bookingType}</p>
        </section>

        <section className="print-card mt-4 overflow-hidden rounded-[22px] bg-white shadow-[0_10px_28px_rgba(80,40,140,0.06)]">
          <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
            <Info label={t.confirm.slipName} value={view.name} />
            <Info label={t.confirm.idNo} value={view.identityNumber || "—"} tone="brand" align="right" testId="identity-number" />
          </div>
          <div className="bg-[#f2f5fa] px-5 py-4 text-center">
            <p className="text-[12px] leading-4 text-[#9a9aa4]">{t.confirm.office}</p>
            <p data-testid="office-name" className="mt-1.5 break-words text-[15px] font-bold leading-6 text-[#6d28d9]">
              {view.office}
            </p>
          </div>
          <div className="px-5 pb-5 pt-4 text-center">
            {view.vehicle ? (
              <>
                <p className="text-[12px] leading-4 text-[#9a9aa4]">{t.confirm.slipVehicle}</p>
                <p className="mt-1.5 text-[15px] font-bold leading-6 text-[#6d28d9]">{view.vehicle}</p>
              </>
            ) : null}
            <p className={view.vehicle ? "mt-5 text-[12px] leading-4 text-[#9a9aa4]" : "text-[12px] leading-4 text-[#9a9aa4]"}>
              {t.confirm.queueRecord}
            </p>
            {ticketUrl ? <QrCard verificationUrl={ticketUrl} reference={booking.reference} layout="slip" /> : null}
          </div>
        </section>

        <button
          type="button"
          className="no-print mx-auto mt-5 block w-fit max-w-full rounded-full bg-[#7c3aed] px-5 py-3 text-[15px] font-semibold text-white shadow-[0_8px_18px_rgba(124,58,237,0.28)]"
          aria-expanded={documentsOpen}
          aria-controls="required-documents"
          onClick={() => setDocumentsOpen((open) => !open)}
        >
          {t.confirm.documentsButton}
        </button>
        <section
          id="required-documents"
          className={documentsOpen ? "mt-4 rounded-[22px] bg-white p-4 shadow-sm" : "print-documents mt-4 hidden rounded-[22px] bg-white p-4 shadow-sm"}
        >
          <h2 className="text-lg font-bold">{t.confirm.guidance}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t.confirm.documentsIntro}</p>
          <div className="mt-4">
            <GuidancePanel guidance={view.guidance} />
          </div>
        </section>
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  tone = "ink",
  align = "left",
  testId,
}: {
  label: string;
  value: string;
  tone?: "ink" | "brand";
  align?: "left" | "right";
  testId?: string;
}) {
  return (
    <div className={`min-w-0 ${align === "right" ? "text-right" : "text-left"}`}>
      <p className="text-[12px] leading-4 text-[#9a9aa4]">{label}</p>
      <p
        data-testid={testId}
        className={`mt-1.5 break-words text-[15px] font-bold leading-6 ${tone === "ink" ? "text-[#171717]" : "text-[#6d28d9]"}`}
      >
        {value}
      </p>
    </div>
  );
}

function SlotArrow() {
  return (
    <div className="flex h-5 items-center text-[#c8c8d0]" aria-hidden="true">
      <span className="h-px flex-1 bg-current" />
      <svg viewBox="0 0 10 10" className="-ml-px h-2.5 w-2.5 fill-none stroke-current" strokeWidth="1.4">
        <path d="M2 1.2 7.2 5 2 8.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

