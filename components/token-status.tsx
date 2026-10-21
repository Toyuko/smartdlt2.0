"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { BookingSummary } from "@/components/booking/summary";
import { useI18n } from "@/components/language";
import { Panel } from "@/components/ui";
import { DEMO_QR_NOTICE } from "@/lib/demo-notice";
import type { VerificationOutcome } from "@/lib/booking/outcomes";
import type { PublicBooking } from "@/lib/booking/public-view";

export function TokenStatus() {
  const params = useParams<{ token: string }>();
  const { t } = useI18n();
  const [outcome, setOutcome] = useState<VerificationOutcome | "">("");
  const [booking, setBooking] = useState<PublicBooking | null>(null);

  useEffect(() => {
    const token = decodeURIComponent(params.token);
    fetch("/api/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const body = await response.json();
        setOutcome(body.outcome ?? "invalid");
        setBooking(body.booking ?? null);
      })
      .catch(() => setOutcome("invalid"));
  }, [params.token]);

  return (
    <Panel>
      <p className="text-sm font-bold text-brand-dark">{DEMO_QR_NOTICE}</p>
      <h1 className="mt-3 text-3xl font-bold">{t.verify.title}</h1>
      <div className="mt-6">{outcome ? <BookingSummary booking={booking} outcome={outcome} /> : <p>{t.book.submitting}</p>}</div>
    </Panel>
  );
}
