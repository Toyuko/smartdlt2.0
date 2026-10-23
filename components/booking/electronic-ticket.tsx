import type { ReactNode } from "react";
import Link from "next/link";
import { BilingualGuidance } from "@/components/booking/document-guidance";
import { QrCard } from "@/components/booking/qr-card";
import { StaffDemoActions } from "@/components/booking/staff-demo-actions";
import type { BookingStatus, VerificationOutcome } from "@/lib/booking/outcomes";
import { DATABASE_RETRY_TH, presentTicket, TICKET_STATUS_TH } from "@/lib/booking/ticket-view";
import { DEMO_NOTICE_TH } from "@/lib/demo-notice";
import { th } from "@/lib/i18n/dictionary";
import type { PublicBooking } from "@/lib/booking/public-view";

const SHEET = {
  title: "ใบนัดอิเล็กทรอนิกส์(E-Booking)",
  personal: "ข้อมูลส่วนตัว",
  citizenId: "หมายเลขประจำตัวประชาชน",
  firstName: "ชื่อ",
  lastName: "นามสกุล",
  booking: "ข้อมูลการจอง",
  province: "จังหวัดที่ทำการจอง",
  office: "สำนักงานที่ทำการจอง",
  type: "ประเภทการจอง",
  appointment: "ข้อมูลการนัดหมาย",
  code: "รหัสการจอง",
  date: "วันที่นัด",
  time: "เวลา",
} as const;

export function TicketUnavailable() {
  return (
    <div lang="th" className="ticket-page mx-auto w-full max-w-lg px-4 py-10 text-center">
      <p role="alert" className="text-lg font-bold" data-testid="ticket-retry">
        {DATABASE_RETRY_TH}
      </p>
      <a href="." className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-brand px-5 font-semibold text-white">
        {th.ticket.retry}
      </a>
    </div>
  );
}

export function TicketMissing() {
  return (
    <div lang="th" className="ticket-page mx-auto w-full max-w-lg px-4 py-10">
      <p role="alert" className="text-lg font-bold" data-testid="ticket-status">
        {TICKET_STATUS_TH.invalid}
      </p>
      <p className="print-disclaimer mt-4 text-sm font-bold leading-6 text-brand-dark" data-testid="print-disclaimer">
        {DEMO_NOTICE_TH}
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
  const view = presentTicket(booking, "th");
  const bookingType = view.applicantShort ? `${view.applicantShort}: ${view.categoryTh}` : view.categoryTh;
  return (
    <div lang="th" className="ticket-page min-h-dvh bg-white px-5 py-8">
      <article data-testid="ticket-sheet" className="ticket-sheet mx-auto w-full max-w-lg overflow-x-hidden">
        <p className="print-disclaimer slip-legal" data-testid="print-disclaimer">
          {DEMO_NOTICE_TH}
        </p>
        <Seal />
        <h1 className="mt-5 text-center text-[22px] font-bold tracking-tight text-[#1c1c1c]">{SHEET.title}</h1>
        <p data-testid="ticket-status" role="status" className={outcome === "valid" ? "slip-legal" : "mx-auto mt-4 max-w-md rounded-2xl bg-brand-soft px-4 py-3 text-center text-sm font-bold leading-6 text-brand-dark"}>
          {TICKET_STATUS_TH[outcome]}
        </p>

        <Section title={SHEET.personal}>
          <Field label={SHEET.citizenId} value={view.reference} />
          <Field label={SHEET.firstName} value={view.firstName} />
          <Field label={SHEET.lastName} value={view.lastName} />
        </Section>

        <Section title={SHEET.booking}>
          <Field label={SHEET.province} value={view.provinceTh} />
          <Field label={SHEET.office} value={view.officeTh} />
          <Field label={SHEET.type} value={bookingType} />
        </Section>

        <Section title={SHEET.appointment}>
          <Field label={SHEET.code} value={view.reference} />
          <Field label={SHEET.date} value={view.ticketDate} />
          <Field label={SHEET.time} value={view.ticketTime} />
        </Section>

        <div className="mt-8">
          <BilingualGuidance guidance={view.guidance} />
        </div>

        <section className="qr-print mt-10">
          {ticketUrl ? <QrCard verificationUrl={ticketUrl} reference={booking.reference} imageSrc={imageSrc} layout="ticket" /> : null}
          <p className="no-print mt-8 text-center">
            <Link href={`/booking-confirmation/${booking.reference}`} className="inline-flex min-h-11 items-center text-sm text-[#6d6d78]">
              {th.ticket.return}
            </Link>
          </p>
        </section>

        {staff ? (
          <StaffDemoActions
            bookingId={staff.bookingId}
            status={staff.status}
            reference={booking.reference}
            category={view.categoryTh}
            service={view.serviceTh}
          />
        ) : null}
      </article>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-[17px] font-bold text-[#1a1a1a]">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-5">
      <p className="text-sm text-[#8b8b96]">{label}</p>
      <p className="mt-1 break-words text-[15px] leading-6 text-[#1a1a1a]">{value}</p>
    </div>
  );
}

function Seal() {
  return (
    <svg aria-hidden="true" viewBox="0 0 120 120" className="mx-auto h-28 w-28">
      <circle cx="60" cy="60" r="58" fill="#4c1d95" />
      <circle cx="60" cy="60" r="52" fill="none" stroke="#e7c56a" strokeWidth="2.5" />
      <circle cx="60" cy="60" r="46" fill="#5b21b6" />
      <circle cx="60" cy="60" r="28" fill="none" stroke="#f0d48a" strokeWidth="3" />
      <circle cx="60" cy="60" r="8" fill="#f0d48a" />
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index * Math.PI) / 4;
        const x2 = 60 + Math.cos(angle) * 22;
        const y2 = 60 + Math.sin(angle) * 22;
        return <line key={index} x1="60" y1="60" x2={x2} y2={y2} stroke="#f0d48a" strokeWidth="2.5" />;
      })}
      <circle cx="60" cy="60" r="40" fill="none" stroke="#d6b25e" strokeWidth="1" />
    </svg>
  );
}
