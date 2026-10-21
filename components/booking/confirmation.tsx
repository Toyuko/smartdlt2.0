"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GuidancePanel } from "@/components/booking/document-guidance";
import { QrCard } from "@/components/booking/qr-card";
import { useI18n } from "@/components/language";
import { Button } from "@/components/ui";
import type { VerificationOutcome } from "@/lib/booking/outcomes";
import { presentTicket, TICKET_STATUS } from "@/lib/booking/ticket-view";
import { DEMO_NOTICE } from "@/lib/demo-notice";
import type { PublicBooking } from "@/lib/booking/public-view";

export function ConfirmationScreen({
  booking,
  outcome,
  initialTicketUrl = "",
}: {
  booking: PublicBooking;
  outcome: VerificationOutcome;
  initialTicketUrl?: string;
}) {
  const { locale, t } = useI18n();
  const [ticketUrl, setTicketUrl] = useState(initialTicketUrl);
  const [documentsOpen, setDocumentsOpen] = useState(false);
  const view = presentTicket(booking, locale);
  const applicant =
    booking.applicantCategory === "foreign" ? t.book.applicantForeign : booking.applicantCategory === "thai" ? t.book.applicantThai : "";

  useEffect(() => {
    if (initialTicketUrl) return;
    const stored = window.sessionStorage.getItem(`vd-verify-url:${booking.reference}`) ?? "";
    // The raw token is not stored. The one-time ticket URL is kept only for this browser session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTicketUrl(stored);
  }, [booking.reference, initialTicketUrl]);

  return (
    <div className="confirmation-page bg-gradient-to-b from-brand-soft to-paper px-4 py-6">
      <div data-testid="confirmation-layout" className="mx-auto w-full max-w-md overflow-x-hidden lg:max-w-xl">
        <Link href="/" className="no-print inline-flex min-h-11 items-center text-sm font-semibold text-brand-dark">
          <span aria-hidden="true" className="mr-1 text-lg">
            ‹
          </span>
          {t.confirm.back}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">{t.confirm.pageTitle}</h1>
        <p className="print-disclaimer mt-3 text-sm font-bold leading-6 text-brand-dark" data-testid="print-disclaimer">
          {DEMO_NOTICE}
        </p>
        <p className="mt-3 text-sm font-semibold text-brand-dark" role="status">
          {TICKET_STATUS[outcome]}
        </p>

        <section className="mt-5 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-line" aria-label={t.confirm.pageTitle}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="min-w-0">
              <p className="text-xs text-muted">{t.confirm.bookingDate}</p>
              <p className="mt-1 break-words text-sm font-bold text-brand-dark">{view.date}</p>
            </div>
            <div className="min-w-0 border-x border-line px-1">
              <p className="break-words text-sm font-bold leading-5 text-brand-dark">{view.category}</p>
              <p className="mt-1 break-words text-xs leading-5 text-muted">{view.service}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted">{t.confirm.round}</p>
              <p className="mt-1 break-words text-sm font-bold leading-5 text-brand-dark">{view.round}</p>
            </div>
          </div>
          {applicant ? (
            <p className="mt-4 text-center text-sm font-semibold text-brand">
              {t.confirm.applicantCategory}: {applicant}
            </p>
          ) : null}
        </section>

        <section className="mt-4 overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-line" aria-label={t.book.name}>
          <div className="grid grid-cols-2 gap-3 px-4 py-5 text-center">
            <div className="min-w-0">
              <p className="text-xs text-muted">{t.book.name}</p>
              <p className="mt-1 break-words font-bold text-brand-dark">{view.name}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted">{t.confirm.demoReference}</p>
              <p className="mt-1 break-all font-bold text-brand-dark">{view.reference}</p>
            </div>
          </div>
          <div className="bg-mist px-4 py-4 text-center">
            <p className="text-xs text-muted">{t.confirm.province}</p>
            <p className="mt-1 break-words font-bold text-brand-dark">{view.province}</p>
          </div>
          <div className="px-4 py-4 text-center">
            <p className="text-xs text-muted">{t.staff.office}</p>
            <p data-testid="office-name" className="mt-1 break-words font-bold leading-6 text-brand-dark">
              {view.office}
            </p>
            <p className="mt-1 break-words text-xs text-muted">{view.demoLabel}</p>
          </div>
          {view.vehicle ? (
            <div className="bg-mist px-4 py-4 text-center">
              <p className="text-xs text-muted">{t.confirm.vehicle}</p>
              <p className="mt-1 font-bold text-brand-dark">{view.vehicle}</p>
            </div>
          ) : null}
        </section>

        <section className="qr-print mt-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-line">
          {ticketUrl ? (
            <QrCard verificationUrl={ticketUrl} reference={booking.reference} heading={t.confirm.saveImage} />
          ) : (
            <p className="text-sm leading-6 text-muted">{t.confirm.qrOnce}</p>
          )}
        </section>

        <Button
          type="button"
          className="no-print mt-4 w-full"
          aria-expanded={documentsOpen}
          aria-controls="required-documents"
          onClick={() => setDocumentsOpen((open) => !open)}
        >
          {t.confirm.documentsButton}
        </Button>
        <section id="required-documents" className={documentsOpen ? "mt-4 rounded-3xl bg-white p-4 shadow-sm ring-1 ring-line" : "print-documents mt-4 hidden rounded-3xl bg-white p-4 shadow-sm ring-1 ring-line"}>
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
