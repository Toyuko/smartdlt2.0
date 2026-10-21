"use client";

import { useState } from "react";
import Link from "next/link";
import { errorText, useI18n } from "@/components/language";
import { Button } from "@/components/ui";
import { TICKET_STATUS } from "@/lib/booking/ticket-view";
import type { BookingStatus } from "@/lib/booking/outcomes";

export function StaffDemoActions({
  bookingId,
  status,
  reference,
  category,
  service,
}: {
  bookingId: string;
  status: BookingStatus;
  reference: string;
  category: string;
  service: string;
}) {
  const { t } = useI18n();
  const [current, setCurrent] = useState(status);
  const [pending, setPending] = useState("");
  const [error, setError] = useState("");

  async function act(action: "check_in" | "complete") {
    setPending(action);
    setError("");
    const response = await fetch(`/api/staff/bookings/${bookingId}/transition`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = (await response.json().catch(() => null)) as { error?: string; booking?: { status?: BookingStatus } } | null;
    setPending("");
    if (!response.ok) {
      if (body?.error === "already_checked_in") setCurrent("checked_in");
      setError(body?.error ?? "transition_failed");
      return;
    }
    if (body?.booking?.status) setCurrent(body.booking.status);
  }

  const statusCopy =
    current === "cancelled"
      ? TICKET_STATUS.cancelled
      : current === "checked_in"
        ? TICKET_STATUS.already_checked_in
        : current === "completed"
          ? TICKET_STATUS.completed
          : TICKET_STATUS.valid;

  return (
    <section className="no-print mt-8 rounded-3xl border border-brand bg-brand-soft p-4" data-testid="staff-demo-actions" aria-label={t.ticket.staffTitle}>
      <h2 className="text-lg font-bold">{t.ticket.staffTitle}</h2>
      <p className="mt-2 text-sm leading-6">{t.ticket.staffNote}</p>
      <dl className="mt-4 space-y-2 text-sm">
        <div>
          <dt className="text-muted">{t.staff.reference}</dt>
          <dd className="font-semibold">{reference}</dd>
        </div>
        <div>
          <dt className="text-muted">{t.staff.category}</dt>
          <dd className="break-words font-semibold">{category}</dd>
        </div>
        <div>
          <dt className="text-muted">{t.staff.service}</dt>
          <dd className="break-words font-semibold">{service}</dd>
        </div>
      </dl>
      <p className="mt-4 text-sm font-semibold" role="status">
        {t.ticket.exists} {statusCopy}
      </p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-full">
          {errorText(t.errors, error)}
        </p>
      ) : null}
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Button type="button" disabled={pending !== "" || current !== "confirmed"} onClick={() => void act("check_in")}>
          {t.actions.checkIn}
        </Button>
        <Button type="button" variant="secondary" disabled={pending !== "" || current !== "checked_in"} onClick={() => void act("complete")}>
          {t.actions.complete}
        </Button>
      </div>
      <Link href={`/staff/bookings/${bookingId}`} className="mt-4 inline-flex min-h-11 items-center font-semibold text-brand-dark">
        {t.ticket.openRecord}
      </Link>
    </section>
  );
}
