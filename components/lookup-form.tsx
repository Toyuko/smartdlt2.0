"use client";

import { useState } from "react";
import { BookingSummary } from "@/components/booking/summary";
import { errorText, SetupRequired, useI18n } from "@/components/language";
import { Button, Field, Panel, inputClass } from "@/components/ui";
import type { PublicBooking } from "@/lib/booking/public-view";
import type { VerificationOutcome } from "@/lib/booking/outcomes";

export function LookupForm() {
  const { t } = useI18n();
  const [reference, setReference] = useState("");
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [outcome, setOutcome] = useState<VerificationOutcome | "">("");
  const [error, setError] = useState("");
  const [setup, setSetup] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    setBooking(null);
    setOutcome("");
    try {
      const response = await fetch("/api/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reference }),
      });
      const body = await response.json();
      if (response.status === 503) {
        setSetup(true);
        return;
      }
      if (!response.ok && !body.outcome) {
        setError(body.error ?? "server_error");
        return;
      }
      setOutcome(body.outcome);
      setBooking(body.booking);
    } catch {
      setError("server_error");
    } finally {
      setPending(false);
    }
  }

  if (setup) return <SetupRequired />;

  return (
    <Panel>
      <h1 className="text-3xl font-bold">{t.lookup.title}</h1>
      <p className="mt-2 text-sm leading-6 text-muted">{t.lookup.help}</p>
      <form className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end" onSubmit={onSubmit}>
        <div className="flex-1">
          <Field label={t.lookup.label} error={error ? errorText(t.errors, error) : ""}>
            <input className={inputClass} value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} autoCapitalize="characters" />
          </Field>
        </div>
        <Button type="submit" disabled={pending}>
          {pending ? t.book.submitting : t.actions.search}
        </Button>
      </form>
      {outcome ? (
        <div className="mt-6">
          <BookingSummary booking={booking} outcome={outcome} />
        </div>
      ) : null}
    </Panel>
  );
}
