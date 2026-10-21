"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { QrCard } from "@/components/booking/qr-card";
import { errorText, SetupRequired, useI18n } from "@/components/language";
import { Button, Panel } from "@/components/ui";
import { DEMO_NOTICE } from "@/lib/demo-notice";
import { formatLongDate, formatTime } from "@/lib/time";
import type { PublicBooking } from "@/lib/booking/public-view";

export function BookingConfirmation() {
  const params = useParams<{ reference: string }>();
  const reference = params.reference;
  const { locale, t } = useI18n();
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [verificationUrl, setVerificationUrl] = useState("");
  const [error, setError] = useState("");
  const [setup, setSetup] = useState(false);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(`vd-verify-url:${reference}`) ?? "";
    const controller = new AbortController();
    fetch(`/api/bookings/${encodeURIComponent(reference)}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (response.status === 503) {
          setSetup(true);
          return;
        }
        if (!response.ok) throw new Error(body.error ?? "not_found");
        setVerificationUrl(stored);
        setBooking(body.booking);
      })
      .catch((reason: Error) => {
        if (reason.name !== "AbortError") setError(reason.message);
      });
    return () => controller.abort();
  }, [reference]);

  if (setup) return <SetupRequired />;
  if (error) return <p role="alert">{errorText(t.errors, error) || t.lookup.missing}</p>;
  if (!booking) return <p>{t.book.submitting}</p>;

  const office = locale === "th" ? booking.officeNameTh : booking.officeName;
  const service = locale === "th" ? booking.serviceNameTh : booking.serviceName;

  return (
    <Panel className="print-card mx-auto max-w-3xl">
      <p className="text-sm font-bold text-brand-dark">{DEMO_NOTICE}</p>
      <h1 className="mt-3 text-3xl font-bold">{t.confirm.title}</h1>
      <p className="mt-2 text-muted">{t.confirm.saved}</p>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <Item label={t.staff.reference} value={booking.reference} />
        <Item label={t.book.name} value={booking.applicantDisplayName} />
        <Item label={t.staff.date} value={`${formatLongDate(booking.startsAt, locale)} · ${formatTime(booking.startsAt)}–${formatTime(booking.endsAt)}`} />
        <Item label={t.staff.status} value={statusLabel(booking.status, t)} />
        <Item label={t.staff.office} value={`${office} — ${booking.demoLabel}`} />
        <Item label={t.staff.service} value={service} />
      </dl>
      <div className="mt-8">
        {verificationUrl ? <QrCard verificationUrl={verificationUrl} reference={booking.reference} /> : <p className="text-sm leading-6 text-muted">{t.confirm.qrOnce}</p>}
      </div>
      <div className="no-print mt-6">
        <Button type="button" variant="secondary" onClick={() => window.print()}>
          {t.actions.print}
        </Button>
      </div>
    </Panel>
  );
}

function statusLabel(status: PublicBooking["status"], t: ReturnType<typeof useI18n>["t"]) {
  if (status === "confirmed") return t.verify.valid;
  if (status === "checked_in") return t.verify.already_checked_in;
  if (status === "completed") return t.verify.completed;
  return t.verify.cancelled;
}

function Item({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
