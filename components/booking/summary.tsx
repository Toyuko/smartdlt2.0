"use client";

import { useI18n } from "@/components/language";
import { DEMO_NOTICE } from "@/lib/demo-notice";
import type { VerificationOutcome } from "@/lib/booking/outcomes";
import type { PublicBooking } from "@/lib/booking/public-view";
import { formatLongDate, formatTime } from "@/lib/time";

export function BookingSummary({ booking, outcome }: { booking: PublicBooking | null; outcome: VerificationOutcome }) {
  const { locale, t } = useI18n();
  return (
    <div className="rounded-2xl bg-paper p-4" role="status">
      <p className="text-lg font-bold text-brand-dark">{t.verify[outcome]}</p>
      <p className="mt-2 text-sm leading-6">{t.verify.means}</p>
      <p className="mt-3 text-xs font-semibold">{DEMO_NOTICE}</p>
      {booking ? (
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted">{t.staff.reference}</dt>
            <dd className="font-semibold">{booking.reference}</dd>
          </div>
          <div>
            <dt className="text-muted">{t.book.name}</dt>
            <dd className="font-semibold">{booking.applicantDisplayName}</dd>
          </div>
          <div>
            <dt className="text-muted">{t.staff.office}</dt>
            <dd className="font-semibold">{locale === "th" ? booking.officeNameTh : booking.officeName}</dd>
          </div>
          <div>
            <dt className="text-muted">{t.staff.service}</dt>
            <dd className="font-semibold">{locale === "th" ? booking.serviceNameTh : booking.serviceName}</dd>
          </div>
          <div>
            <dt className="text-muted">{t.staff.date}</dt>
            <dd className="font-semibold">
              {formatLongDate(booking.startsAt, locale)} · {formatTime(booking.startsAt)}–{formatTime(booking.endsAt)}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="mt-3 text-sm">{outcome === "not_found" ? t.lookup.missing : t.verify.invalid}</p>
      )}
    </div>
  );
}
