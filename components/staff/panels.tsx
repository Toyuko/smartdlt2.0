"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BookingSummary } from "@/components/booking/summary";
import { errorText, useI18n } from "@/components/language";
import { Button, Field, Panel, inputClass } from "@/components/ui";
import { parseScanPayload } from "@/lib/booking/codes";
import type { VerificationOutcome } from "@/lib/booking/outcomes";
import type { PublicBooking } from "@/lib/booking/public-view";
import { isPublicConfigured } from "@/lib/public-env";
import { formatLongDate, formatTime } from "@/lib/time";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { AuditEntry, StaffBooking } from "@/lib/data/store";

function safeNext(value: string | null) {
  if (!value || !value.startsWith("/staff/") || value.startsWith("//") || value.includes("\\") || value.includes("://") || value.startsWith("/staff/login")) {
    return "/staff/dashboard";
  }
  return value;
}

export function LoginForm() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(params.get("error") === "not_staff" ? "forbidden" : "");
  const [pending, setPending] = useState(false);
  const configured = isPublicConfigured();

  useEffect(() => {
    if (params.get("error") === "not_staff" && configured) {
      void createSupabaseBrowserClient().auth.signOut();
    }
  }, [configured, params]);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    if (!configured) {
      setError("setup_required");
      setPending(false);
      return;
    }
    const supabase = createSupabaseBrowserClient();
    const signIn = await supabase.auth.signInWithPassword({ email, password });
    if (signIn.error) {
      setError("unauthenticated");
      setPending(false);
      return;
    }
    const session = await fetch("/api/staff/session");
    if (!session.ok) {
      await supabase.auth.signOut();
      setError(session.status === 403 ? "forbidden" : "unauthenticated");
      setPending(false);
      return;
    }
    router.push(safeNext(params.get("next")));
    router.refresh();
  }

  return (
    <Panel className="mx-auto max-w-lg">
      <h1 className="text-3xl font-bold">{t.staff.loginTitle}</h1>
      <p className="mt-2 text-sm leading-6 text-muted">{t.staff.loginHelp}</p>
      <form className="mt-6 space-y-4" onSubmit={onSubmit}>
        <Field label={t.staff.email}>
          <input className={inputClass} type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Field label={t.staff.password} error={error === "forbidden" ? t.staff.notStaff : error === "setup_required" ? t.setup.body : error ? t.staff.failed : ""}>
          <input className={inputClass} type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? t.book.submitting : t.actions.signIn}
        </Button>
      </form>
    </Panel>
  );
}

export function StaffNav({ displayName }: { displayName: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const links = [
    ["/staff/dashboard", t.staff.dashboard],
    ["/staff/bookings", t.staff.bookings],
    ["/staff/scan", t.staff.scan],
    ["/staff/settings", t.staff.settings],
  ] as const;
  return (
    <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm text-muted">
        {t.staff.signedIn} <span className="font-semibold text-ink">{displayName}</span>
      </p>
      <div className="flex flex-wrap gap-2">
        {links.map(([href, label]) => (
          <Link key={href} href={href} className="rounded-full bg-white px-3 py-2 text-sm font-semibold ring-1 ring-line">
            {label}
          </Link>
        ))}
        <Button
          type="button"
          variant="ghost"
          onClick={async () => {
            await createSupabaseBrowserClient().auth.signOut();
            router.push("/staff/login");
            router.refresh();
          }}
        >
          {t.actions.signOut}
        </Button>
      </div>
    </div>
  );
}

type Counts = { today: number; week: number; upcoming: number; cancelled: number; checked_in: number; completed: number };

export function DashboardPanel() {
  const { t } = useI18n();
  const [counts, setCounts] = useState<Counts | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/staff/summary")
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "summary_unavailable");
        setCounts(body.counts);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  const cards = counts
    ? [
        [t.staff.today, counts.today],
        [t.staff.week, counts.week],
        [t.staff.upcoming, counts.upcoming],
        [t.staff.checkedIn, counts.checked_in],
        [t.staff.completed, counts.completed],
        [t.staff.cancelled, counts.cancelled],
      ]
    : [];

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{t.staff.dashboard}</h1>
      {error ? <p role="alert">{errorText(t.errors, error)}</p> : null}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map(([label, value]) => (
          <Panel key={String(label)}>
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-2 text-3xl font-bold">{value}</p>
          </Panel>
        ))}
      </div>
    </div>
  );
}

export function BookingList() {
  const { locale, t } = useI18n();
  const [reference, setReference] = useState("");
  const [officeId, setOfficeId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [status, setStatus] = useState("");
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<StaffBooking[]>([]);
  const [offices, setOffices] = useState<Array<{ id: string; name: string; nameTh: string }>>([]);
  const [services, setServices] = useState<Array<{ id: string; name: string; nameTh: string }>>([]);
  const [error, setError] = useState("");

  async function load(next = { reference, officeId, serviceId, status, date }) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, value);
    const response = await fetch(`/api/staff/bookings?${params}`);
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "booking_unavailable");
      return;
    }
    setRows(body.bookings);
    setError("");
  }

  useEffect(() => {
    const params = new URLSearchParams();
    fetch(`/api/staff/bookings?${params}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          setError(body.error ?? "booking_unavailable");
          return;
        }
        setRows(body.bookings);
      })
      .catch(() => setError("booking_unavailable"));
    fetch("/api/catalog")
      .then((response) => response.json())
      .then((body) => {
        setOffices(body.offices ?? []);
        setServices(body.services ?? []);
      })
      .catch(() => undefined);
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{t.staff.bookings}</h1>
      <form
        className="grid gap-3 rounded-3xl bg-white p-4 ring-1 ring-line md:grid-cols-5"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <input className={inputClass} placeholder={t.staff.reference} value={reference} onChange={(event) => setReference(event.target.value.toUpperCase())} aria-label={t.staff.reference} />
        <select className={inputClass} value={officeId} onChange={(event) => setOfficeId(event.target.value)} aria-label={t.staff.office}>
          <option value="">{t.staff.all}</option>
          {offices.map((office) => (
            <option key={office.id} value={office.id}>
              {locale === "th" ? office.nameTh : office.name}
            </option>
          ))}
        </select>
        <select className={inputClass} value={serviceId} onChange={(event) => setServiceId(event.target.value)} aria-label={t.staff.service}>
          <option value="">{t.staff.all}</option>
          {services.map((service) => (
            <option key={service.id} value={service.id}>
              {locale === "th" ? service.nameTh : service.name}
            </option>
          ))}
        </select>
        <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)} aria-label={t.staff.status}>
          <option value="">{t.staff.all}</option>
          <option value="confirmed">confirmed</option>
          <option value="checked_in">checked_in</option>
          <option value="completed">completed</option>
          <option value="cancelled">cancelled</option>
        </select>
        <input className={inputClass} type="date" value={date} onChange={(event) => setDate(event.target.value)} aria-label={t.staff.date} />
        <Button type="submit">{t.actions.search}</Button>
      </form>
      {error ? <p role="alert">{errorText(t.errors, error)}</p> : null}
      {rows.length === 0 ? <p className="text-sm text-muted">{t.staff.empty}</p> : null}
      <div className="grid gap-3">
        {rows.map((row) => (
          <Link key={row.id} href={`/staff/bookings/${row.id}`} className="rounded-3xl bg-white p-4 ring-1 ring-line">
            <span className="font-bold">{row.reference}</span>
            <span className="mt-1 block text-sm text-muted">
              {row.applicantDisplayName} · {locale === "th" ? row.officeNameTh : row.officeName} · {formatLongDate(row.startsAt, locale)} {formatTime(row.startsAt)} · {row.status}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function BookingDetail({ id }: { id: string }) {
  const { locale, t } = useI18n();
  const [booking, setBooking] = useState<StaffBooking | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    fetch(`/api/staff/bookings/${id}`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          setError(body.error ?? "booking_unavailable");
          return;
        }
        setBooking(body.booking);
        setAudit(body.audit);
      })
      .catch(() => setError("booking_unavailable"));
  }, [id]);

  async function act(action: "check_in" | "complete" | "cancel") {
    setPending(action);
    setError("");
    const response = await fetch(`/api/staff/bookings/${id}/transition`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const body = await response.json();
    setPending("");
    setConfirmCancel(false);
    if (!response.ok) {
      setError(body.error ?? "transition_failed");
      return;
    }
    setBooking(body.booking);
    setAudit(body.audit);
  }

  if (!booking && !error) return <p>{t.book.submitting}</p>;
  if (!booking) return <p role="alert">{errorText(t.errors, error)}</p>;

  return (
    <Panel>
      <h1 className="text-3xl font-bold">{booking.reference}</h1>
      <p className="mt-2 text-sm text-muted">{booking.demoLabel}</p>
      <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <Info label={t.book.name} value={booking.applicantDisplayName} />
        <Info label={t.staff.status} value={booking.status} />
        <Info label={t.staff.office} value={locale === "th" ? booking.officeNameTh : booking.officeName} />
        <Info label={t.staff.service} value={locale === "th" ? booking.serviceNameTh : booking.serviceName} />
        <Info label={t.staff.date} value={`${formatLongDate(booking.startsAt, locale)} ${formatTime(booking.startsAt)}–${formatTime(booking.endsAt)}`} />
        <Info label={t.book.email} value={booking.contactEmail ?? "—"} />
        <Info label={t.book.phone} value={booking.contactPhone ?? "—"} />
        <Info label={t.book.notes} value={booking.notes ?? "—"} />
      </dl>
      {error ? <p role="alert" className="mt-4 text-sm text-full">{errorText(t.errors, error)}</p> : null}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button type="button" disabled={pending !== "" || booking.status !== "confirmed"} onClick={() => act("check_in")}>
          {t.actions.checkIn}
        </Button>
        <Button type="button" variant="secondary" disabled={pending !== "" || booking.status !== "checked_in"} onClick={() => act("complete")}>
          {t.actions.complete}
        </Button>
        <Button type="button" variant="danger" disabled={pending !== "" || (booking.status !== "confirmed" && booking.status !== "checked_in")} onClick={() => setConfirmCancel(true)}>
          {t.actions.cancelBooking}
        </Button>
      </div>
      {confirmCancel ? (
        <div className="mt-4 rounded-2xl bg-full/10 p-4" role="alertdialog" aria-label={t.staff.cancelAsk}>
          <p className="font-semibold">{t.staff.cancelAsk}</p>
          <div className="mt-3 flex gap-2">
            <Button type="button" variant="danger" onClick={() => act("cancel")}>{t.actions.confirm}</Button>
            <Button type="button" variant="secondary" onClick={() => setConfirmCancel(false)}>{t.actions.keep}</Button>
          </div>
        </div>
      ) : null}
      <h2 className="mt-8 text-xl font-bold">{t.staff.audit}</h2>
      {audit.length === 0 ? <p className="mt-2 text-sm text-muted">{t.staff.noAudit}</p> : null}
      <ol className="mt-3 space-y-2">
        {audit.map((entry) => (
          <li key={entry.id} className="rounded-2xl bg-paper px-3 py-2 text-sm">
            <span className="font-semibold">{entry.action}</span> · {formatLongDate(entry.createdAt, locale)} {formatTime(entry.createdAt)}
            {entry.metadata.from ? ` · ${entry.metadata.from} → ${entry.metadata.to}` : ""}
          </li>
        ))}
      </ol>
    </Panel>
  );
}

export function Scanner() {
  const { t } = useI18n();
  const regionRef = useRef<HTMLDivElement>(null);
  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null);
  const [manual, setManual] = useState("");
  const [message, setMessage] = useState("");
  const [outcome, setOutcome] = useState<VerificationOutcome | "">("");
  const [booking, setBooking] = useState<PublicBooking | null>(null);
  const [bookingId, setBookingId] = useState("");

  useEffect(() => {
    return () => {
      void scannerRef.current?.stop().catch(() => undefined);
    };
  }, []);

  async function verify(payload: { token?: string; reference?: string }) {
    const response = await fetch("/api/staff/verify", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await response.json();
    if (!response.ok && !body.outcome) {
      setMessage(body.error ?? "server_error");
      setOutcome("");
      return;
    }
    setMessage("");
    setOutcome(body.outcome);
    setBooking(body.booking);
    setBookingId(body.booking?.id ?? "");
  }

  async function startCamera() {
    setMessage("");
    const { Html5Qrcode } = await import("html5-qrcode");
    const scanner = new Html5Qrcode("demo-qr-region");
    scannerRef.current = scanner;
    try {
      await scanner.start(
        { facingMode: "environment" },
        { fps: 8, qrbox: 220 },
        (text) => {
          const parsed = parseScanPayload(text, [window.location.origin]);
          if (parsed.type === "rejected") {
            setMessage("invalid");
            return;
          }
          void scanner.stop();
          void verify(parsed.type === "token" ? { token: parsed.token } : { reference: parsed.reference });
        },
        () => undefined,
      );
    } catch {
      setMessage("camera");
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">{t.staff.scan}</h1>
      <Panel>
        <div id="demo-qr-region" ref={regionRef} className="overflow-hidden rounded-2xl bg-paper" />
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" onClick={() => void startCamera()}>{t.staff.camera}</Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void scannerRef.current?.stop().catch(() => undefined);
            }}
          >
            {t.staff.stopCamera}
          </Button>
        </div>
        {message === "camera" ? <p className="mt-3 text-sm">{t.staff.cameraDenied}</p> : null}
        {message && message !== "camera" ? <p role="alert" className="mt-3 text-sm text-full">{errorText(t.errors, message)}</p> : null}
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = parseScanPayload(manual, [window.location.origin]);
            if (parsed.type === "rejected") {
              setMessage("invalid");
              return;
            }
            void verify(parsed.type === "token" ? { token: parsed.token } : { reference: parsed.reference });
          }}
        >
          <div className="flex-1">
            <Field label={t.staff.manual}>
              <input className={inputClass} value={manual} onChange={(event) => setManual(event.target.value)} />
            </Field>
          </div>
          <Button type="submit">{t.actions.search}</Button>
        </form>
      </Panel>
      {outcome ? <BookingSummary booking={booking} outcome={outcome} /> : null}
      {bookingId ? (
        <Link href={`/staff/bookings/${bookingId}`} className="inline-flex font-semibold text-brand">
          {t.staff.bookings}
        </Link>
      ) : null}
    </div>
  );
}

export function SettingsPanel({ displayName, role }: { displayName: string; role: string }) {
  const { t } = useI18n();
  return (
    <Panel>
      <h1 className="text-3xl font-bold">{t.staff.settings}</h1>
      <p className="mt-3 text-sm leading-6 text-muted">{t.staff.settingsBody}</p>
      <p className="mt-4 text-sm">
        {t.staff.signedIn} <span className="font-semibold">{displayName}</span> · {role}
      </p>
    </Panel>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
