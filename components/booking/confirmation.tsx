"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GuidancePanel } from "@/components/booking/document-guidance";
import { QrCard } from "@/components/booking/qr-card";
import { useI18n } from "@/components/language";
import type { VerificationOutcome } from "@/lib/booking/outcomes";
import { presentTicket } from "@/lib/booking/ticket-view";
import { DEMO_NOTICE } from "@/lib/demo-notice";
import type { PublicBooking } from "@/lib/booking/public-view";

export function ConfirmationScreen({
  booking,
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

  useEffect(() => {
    if (initialTicketUrl) return;
    const stored = window.sessionStorage.getItem(`vd-verify-url:${booking.reference}`) ?? "";
    // The raw token is not stored. The one-time ticket URL is kept only for this browser session.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTicketUrl(stored);
  }, [booking.reference, initialTicketUrl]);

  return (
    <div className="confirmation-page min-h-dvh bg-[linear-gradient(180deg,#efe6ff_0%,#f7f3fc_32%,#f4f3f6_100%)] px-4 pb-24 pt-3 lg:pb-10">
      <div data-testid="confirmation-layout" className="mx-auto w-full max-w-md overflow-x-hidden lg:max-w-xl">
        <p className="print-disclaimer slip-legal" data-testid="print-disclaimer">
          {DEMO_NOTICE}
        </p>
        <div className="relative flex h-10 items-center justify-center">
          <Link href="/" aria-label={t.confirm.back} className="absolute left-0 grid h-11 w-11 place-items-center text-[#2c2144]">
            <Chevron />
          </Link>
          <h1 className="text-lg font-bold text-[#2c2144]">{t.confirm.pageTitle}</h1>
        </div>

        <section className="mt-2 rounded-2xl bg-white px-3 py-3 shadow-[0_8px_24px_rgba(90,50,150,0.06)]" aria-label={t.confirm.pageTitle}>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="min-w-0">
              <p className="text-[11px] text-[#9a9aa6]">{t.confirm.bookingDate}</p>
              <p className="mt-2 break-words text-sm font-bold text-[#6d3cc8]">{view.date}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-[#9a9aa6]">{t.confirm.pageTitle}</p>
              {view.applicantShort ? <p className="mt-2 break-words text-sm font-bold leading-5 text-[#6d3cc8]">{view.applicantShort}</p> : null}
              <p className="mt-1 break-words text-[11px] font-bold uppercase leading-4 text-[#6d3cc8]">{view.categoryUpper}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-[#9a9aa6]">{t.confirm.round}</p>
              <p className="mt-2 break-words text-sm font-bold leading-5 text-[#6d3cc8]">{view.slipRound}</p>
            </div>
          </div>
        </section>

        <section className="mt-3 rounded-2xl bg-white px-4 py-3 shadow-[0_8px_24px_rgba(90,50,150,0.06)]" aria-label={t.confirm.slipName}>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="min-w-0">
              <p className="text-xs text-[#9a9aa6]">{t.confirm.slipName}</p>
              <p className="mt-2 break-words text-base font-bold text-[#222]">{view.name}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-[#9a9aa6]">{t.confirm.idNo}</p>
              <p className="mt-2 text-[13px] font-bold tracking-tight text-[#6d3cc8]">{view.reference}</p>
            </div>
          </div>
        </section>

        <div className="mt-3 px-3 text-center">
          <p className="text-sm text-[#8e8e98]">{t.staff.office}</p>
          <p data-testid="office-name" className="mt-1 break-words text-base font-bold leading-6 text-[#6d3cc8]">
            {view.office}
          </p>
        </div>
        {view.vehicle ? (
          <div className="mt-3 px-3 text-center">
            <p className="text-sm text-[#8e8e98]">{t.confirm.slipVehicle}</p>
            <p className="mt-1 text-base font-bold text-[#6d3cc8]">{view.vehicle}</p>
          </div>
        ) : null}

        <section className="qr-print mt-3 rounded-2xl bg-white px-4 py-3 shadow-[0_8px_24px_rgba(90,50,150,0.06)]">
          <h2 className="text-center text-base font-semibold text-[#2a2a2a]">{t.confirm.saveImage}</h2>
          {ticketUrl ? (
            <QrCard verificationUrl={ticketUrl} reference={booking.reference} layout="slip" />
          ) : (
            <p className="mt-3 text-center text-sm leading-6 text-muted">{t.confirm.qrOnce}</p>
          )}
        </section>

        <button
          type="button"
          className="no-print mt-4 w-full rounded-xl bg-[#7b3aed] px-4 py-3.5 text-base font-semibold text-white"
          aria-expanded={documentsOpen}
          aria-controls="required-documents"
          onClick={() => setDocumentsOpen((open) => !open)}
        >
          {t.confirm.documentsButton}
        </button>
        <section
          id="required-documents"
          className={documentsOpen ? "mt-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line" : "print-documents mt-4 hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-line"}
        >
          <h2 className="text-lg font-bold">{t.confirm.guidance}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">{t.confirm.documentsIntro}</p>
          <div className="mt-4">
            <GuidancePanel guidance={view.guidance} />
          </div>
        </section>
      </div>
      <SlipNav reference={booking.reference} />
    </div>
  );
}

function SlipNav({ reference }: { reference: string }) {
  const { t } = useI18n();
  const items = [
    { href: "/", label: t.confirm.navHome, icon: "home" as const, current: false },
    { href: "/lookup", label: t.confirm.navProfile, icon: "profile" as const, current: false },
    { href: `/booking-confirmation/${reference}`, label: t.confirm.navHistory, icon: "history" as const, current: true },
    { href: "/about-demo", label: t.confirm.navSetting, icon: "setting" as const, current: false },
  ];
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-[#ececf2] bg-white pb-[max(0.35rem,env(safe-area-inset-bottom))] lg:hidden" aria-label="Primary">
      <p className="pointer-events-none absolute right-4 top-1 text-[10px] text-[#b0b0b8]">{t.confirm.versionLabel}</p>
      <div className="grid grid-cols-4 px-1 pt-3">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            aria-current={item.current ? "page" : undefined}
            className={`relative flex flex-col items-center gap-1 pb-1 text-[11px] font-medium ${item.current ? "text-[#6d28d9]" : "text-[#c4b0ea]"}`}
          >
            {item.current ? <span className="absolute -top-3 h-0.5 w-8 rounded-full bg-[#7b3aed]" /> : null}
            <NavIcon name={item.icon} />
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}

function Chevron() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6 fill-none stroke-current" strokeWidth="2">
      <path d="M15 5l-7 7 7 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function NavIcon({ name }: { name: "home" | "profile" | "history" | "setting" }) {
  const common = "h-6 w-6 fill-none stroke-current";
  if (name === "home") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} strokeWidth="1.8">
        <path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "profile") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} strokeWidth="1.8">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5 19.2c1.4-3 3.8-4.4 7-4.4s5.6 1.4 7 4.4" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "history") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" className={common} strokeWidth="1.8">
        <rect x="4" y="5" width="16" height="15" rx="2" />
        <path d="M8 3.5v3M16 3.5v3M4 9.5h16" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={common} strokeWidth="1.8">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3V20.5M3.5 12h2.2M18.3 12h2.2M6 6l1.6 1.6M16.4 16.4 18 18M18 6l-1.6 1.6M7.6 16.4 6 18" strokeLinecap="round" />
    </svg>
  );
}
