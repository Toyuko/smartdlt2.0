import type { ReactNode } from "react";
import Link from "next/link";
import { BilingualGuidance } from "@/components/booking/document-guidance";
import { QrCard } from "@/components/booking/qr-card";
import { StaffDemoActions } from "@/components/booking/staff-demo-actions";
import type { BookingStatus, VerificationOutcome } from "@/lib/booking/outcomes";
import { DATABASE_RETRY, presentTicket, TICKET_STATUS } from "@/lib/booking/ticket-view";
import { DEMO_NOTICE } from "@/lib/demo-notice";
import { en, th } from "@/lib/i18n/dictionary";
import type { PublicBooking } from "@/lib/booking/public-view";

export function TicketUnavailable() {
  return (
    <div className="ticket-page mx-auto w-full max-w-lg px-4 py-10 text-center">
      <p role="alert" className="text-lg font-bold" data-testid="ticket-retry">
        {DATABASE_RETRY}
      </p>
      <a href="." className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-5 font-semibold text-white">
        {en.ticket.retry}
      </a>
    </div>
  );
}

export function TicketMissing() {
  return (
    <div className="ticket-page mx-auto w-full max-w-lg px-4 py-10">
      <p role="alert" className="text-lg font-bold" data-testid="ticket-status">
        {TICKET_STATUS.invalid}
      </p>
      <p className="print-disclaimer mt-4 text-sm font-bold leading-6 text-brand-dark" data-testid="print-disclaimer">
        {DEMO_NOTICE}
      </p>
    </div>
  );
}

export function ElectronicTicket({
  booking,
  outcome,
  ticketUrl,
  imageSrc,
  staff,
}: {
  booking: PublicBooking;
  outcome: VerificationOutcome;
  ticketUrl: string;
  imageSrc: string;
  staff: { bookingId: string; status: BookingStatus } | null;
}) {
  const view = presentTicket(booking, "en");
  return (
    <div className="ticket-page bg-white px-4 py-6">
      <article data-testid="ticket-sheet" className="ticket-sheet mx-auto w-full max-w-lg overflow-x-hidden lg:max-w-xl">
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full bg-brand text-center text-sm font-bold leading-tight text-white" aria-hidden="true">
          Smart
          <br />
          DLT2.0
        </div>
        <p className="mt-3 text-center text-xs font-semibold uppercase tracking-wide text-brand">SmartDLT2.0</p>
        <h1 className="mt-4 text-center text-2xl font-bold">{en.ticket.title}</h1>
        <p className="mt-1 text-center text-lg font-semibold">{th.ticket.title}</p>
        <p className="print-disclaimer mt-4 text-center text-sm font-bold leading-6 text-brand-dark" data-testid="print-disclaimer">
          {DEMO_NOTICE}
        </p>
        <p data-testid="ticket-status" role="status" className="mt-4 rounded-2xl bg-brand-soft px-4 py-3 text-center text-sm font-bold leading-6 text-brand-dark">
          {TICKET_STATUS[outcome]}
        </p>

        <TicketSection title={en.ticket.personal} titleTh={th.ticket.personal}>
          <TicketField label={en.ticket.name} labelTh={th.ticket.name} value={view.name} tone="white" />
          <TicketField label={en.confirm.demoReference} labelTh={th.confirm.demoReference} value={view.reference} tone="mist" />
        </TicketSection>

        <TicketSection title={en.ticket.bookingInfo} titleTh={th.ticket.bookingInfo}>
          <TicketField label={en.ticket.province} labelTh={th.ticket.province} value={view.provinceEn} secondary={view.provinceTh} tone="white" />
          <TicketField label={en.ticket.office} labelTh={th.ticket.office} value={view.officeEn} secondary={view.officeTh} tone="mist" />
          <TicketField label={en.ticket.category} labelTh={th.ticket.category} value={view.categoryEn} secondary={view.categoryTh} tone="white" />
          <TicketField label={en.ticket.service} labelTh={th.ticket.service} value={view.serviceEn} secondary={view.serviceTh} tone="mist" />
          {view.vehicleEn ? (
            <TicketField label={en.ticket.vehicle} labelTh={th.ticket.vehicle} value={view.vehicleEn} secondary={view.vehicleTh} tone="white" />
          ) : null}
        </TicketSection>

        <TicketSection title={en.ticket.appointment} titleTh={th.ticket.appointment}>
          <TicketField label={en.staff.reference} labelTh={th.staff.reference} value={view.reference} tone="white" />
          <TicketField label={en.ticket.date} labelTh={th.ticket.date} value={view.date} tone="mist" />
          <TicketField label={en.ticket.time} labelTh={th.ticket.time} value={view.round} tone="white" />
          <TicketField label={en.ticket.status} labelTh={th.ticket.status} value={TICKET_STATUS[outcome]} tone="mist" />
          <p className="px-4 py-3 text-center text-xs text-muted">{en.ticket.clock}</p>
        </TicketSection>

        <section className="mt-8">
          <h2 className="text-lg font-bold">{th.ticket.guidance}</h2>
          <p className="text-sm text-muted">{en.ticket.guidance}</p>
          <div className="mt-3 rounded-3xl border border-line px-4 py-4">
            <BilingualGuidance guidance={view.guidance} />
          </div>
        </section>

        <section className="qr-print mt-8 rounded-3xl border border-line p-4">
          {ticketUrl ? <QrCard verificationUrl={ticketUrl} reference={booking.reference} imageSrc={imageSrc} heading={en.confirm.saveImage} /> : null}
          <p className="no-print mt-4 text-center">
            <Link href={`/booking-confirmation/${booking.reference}`} className="inline-flex min-h-11 items-center font-semibold text-brand-dark">
              {en.ticket.return}
            </Link>
          </p>
        </section>

        {staff ? (
          <StaffDemoActions
            bookingId={staff.bookingId}
            status={staff.status}
            reference={booking.reference}
            category={view.categoryEn}
            service={view.serviceEn}
          />
        ) : null}
      </article>
    </div>
  );
}

function TicketSection({ title, titleTh, children }: { title: string; titleTh: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-bold">{titleTh}</h2>
      <p className="text-sm text-muted">{title}</p>
      <div className="mt-3 overflow-hidden rounded-3xl border border-line">{children}</div>
    </section>
  );
}

function TicketField({
  label,
  labelTh,
  value,
  secondary,
  tone,
}: {
  label: string;
  labelTh: string;
  value: string;
  secondary?: string;
  tone: "white" | "mist";
}) {
  return (
    <div className={tone === "mist" ? "bg-mist px-4 py-4 text-center" : "bg-white px-4 py-4 text-center"}>
      <p className="text-sm text-muted">{labelTh}</p>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 break-words text-base font-semibold text-brand-dark">{value}</p>
      {secondary ? <p className="mt-1 break-words text-sm text-muted">{secondary}</p> : null}
    </div>
  );
}
