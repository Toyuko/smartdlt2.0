"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { errorText, SetupRequired, useI18n } from "@/components/language";
import { Button, Field, Panel, inputClass } from "@/components/ui";
import {
  activeOptions,
  applicableAnswers,
  bookingCategorySeed,
  categoryBySlug,
  describeRenewalRules,
  evaluateRenewal,
  isWithinHorizon,
  validateSelection,
  visibleFields,
  type BookingCategory,
} from "@/lib/booking/categories";
import { bookingRequestSchema, fieldErrorsFromZod, type BookingRequest } from "@/lib/booking/validation";
import { DEMO_NOTICE } from "@/lib/demo-notice";
import type { CatalogOffice, CatalogService, CatalogVehicle } from "@/lib/data/store";
import { bangkokDateParts, formatBookingDate, formatTime, shiftIsoDate } from "@/lib/time";

type Catalog = {
  offices: CatalogOffice[];
  services: CatalogService[];
  vehicles: CatalogVehicle[];
  categories?: BookingCategory[];
};

type Slot = { id: string; starts_at: string; ends_at: string; capacity: number; remaining: number };

type AddedCustomer = { reference: string; name: string; when: string };

type Prefs = {
  officeId?: string;
  serviceId?: string;
  applicantCategory?: string;
  vehicleCategory?: string;
  answers?: Record<string, string>;
  acceptDisclaimer?: boolean;
};

const PREFS_KEY = "vd-staff-signup";

function readPrefs(): Prefs | null {
  try {
    const raw = window.sessionStorage.getItem(PREFS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Prefs;
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function monthsForHorizon(today: string, horizonDays: number) {
  const start = today.slice(0, 7);
  const end = shiftIsoDate(today, horizonDays).slice(0, 7);
  return start === end ? [start] : [start, end];
}

function categoryOf(categories: BookingCategory[], service: CatalogService | undefined) {
  if (!service) return undefined;
  return categories.find((item) => item.slug === service.category) ?? categoryBySlug(service.category);
}

function servicesFor(catalog: Catalog, categories: BookingCategory[], office: CatalogOffice | undefined) {
  return catalog.services.filter((item) => {
    const itemCategory = categoryOf(categories, item);
    if (!itemCategory?.active || !office) return false;
    return !itemCategory.eligibleOfficeSlugs.length || itemCategory.eligibleOfficeSlugs.includes(office.slug);
  });
}

export function QuickSignup() {
  const { locale, t } = useI18n();
  const nameRef = useRef<HTMLInputElement>(null);
  const submitLock = useRef(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [setup, setSetup] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [seenCatalog, setSeenCatalog] = useState<Catalog | null>(null);
  const [officeId, setOfficeId] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [applicantCategory, setApplicantCategory] = useState<"thai" | "foreign">("thai");
  const [vehicleCategory, setVehicleCategory] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptDisclaimer, setAcceptDisclaimer] = useState(false);
  const [timeSlotId, setTimeSlotId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadedSlotKey, setLoadedSlotKey] = useState("");
  const [slotReload, setSlotReload] = useState(0);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [latest, setLatest] = useState<AddedCustomer | null>(null);
  const [recent, setRecent] = useState<AddedCustomer[]>([]);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/catalog", { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (response.status === 503) {
          setSetup(true);
          return;
        }
        if (!response.ok) throw new Error(body.error ?? "catalog_unavailable");
        setCatalog(body);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setLoadError(error.message);
      });
    return () => controller.abort();
  }, []);

  const categories = useMemo(() => {
    const rows = catalog?.categories?.length ? catalog.categories : bookingCategorySeed;
    return rows.filter((item) => item.active).sort((left, right) => left.sortOrder - right.sortOrder);
  }, [catalog]);

  const office = catalog?.offices.find((item) => item.id === officeId);
  const service = catalog?.services.find((item) => item.id === serviceId);
  const category = categoryOf(categories, service);
  const services = catalog ? servicesFor(catalog, categories, office) : [];
  const vehicleChoices = (catalog?.vehicles ?? []).filter((item) => !category?.vehicleSlugs.length || category.vehicleSlugs.includes(item.slug));
  const fields = visibleFields(category, service?.slug ?? "");
  const today = bangkokDateParts().isoDate;
  const horizonDays = category?.slotRules.horizonDays ?? 21;
  const renewal = category ? evaluateRenewal(category, answers, today) : { state: "not_applicable" as const };
  const renewalBlocked = renewal.state === "outside" || renewal.state === "invalid_date" || renewal.state === "missing";
  const renewalHint = category ? describeRenewalRules(category.slotRules, locale) : "";

  if (catalog && catalog !== seenCatalog) {
    const saved = readPrefs();
    const nextOffice = catalog.offices.find((item) => item.id === saved?.officeId) ?? catalog.offices[0];
    const offered = servicesFor(catalog, categories, nextOffice);
    const nextService = offered.find((item) => item.id === saved?.serviceId) ?? offered.find((item) => item.slug === "new-car") ?? offered[0];
    const nextCategory = categoryOf(categories, nextService);
    setSeenCatalog(catalog);
    setOfficeId(nextOffice?.id ?? "");
    setServiceId(nextService?.id ?? "");
    setApplicantCategory(saved?.applicantCategory === "foreign" ? "foreign" : "thai");
    setVehicleCategory(nextService?.requiresVehicle ? (saved?.vehicleCategory ?? "") : "");
    setAnswers(applicableAnswers(nextCategory, nextService?.slug ?? "", saved?.answers ?? {}));
    setAcceptDisclaimer(Boolean(saved?.acceptDisclaimer));
    setIdempotencyKey((current) => current || crypto.randomUUID());
  }
  const ready = Boolean(catalog && catalog === seenCatalog);
  const slotKey = `${officeId}|${serviceId}|${slotReload}`;
  const slotsReady = ready && !renewalBlocked && loadedSlotKey === slotKey;
  const openSlots = slotsReady ? slots : [];
  const selectedSlotId = openSlots.some((slot) => slot.id === timeSlotId) ? timeSlotId : (openSlots[0]?.id ?? "");
  const slotsLoading = ready && !renewalBlocked && Boolean(officeId && serviceId) && !slotsReady;

  useEffect(() => {
    if (!ready) return;
    window.sessionStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ officeId, serviceId, applicantCategory, vehicleCategory, answers, acceptDisclaimer }),
    );
  }, [acceptDisclaimer, answers, applicantCategory, officeId, ready, serviceId, vehicleCategory]);

  useEffect(() => {
    if (!ready || !officeId || !serviceId || renewalBlocked) return;
    const controller = new AbortController();
    let cancelled = false;
    const key = slotKey;
    const months = monthsForHorizon(today, horizonDays);
    Promise.all(
      months.map(async (month) => {
        const params = new URLSearchParams({ officeId, serviceId, month });
        const response = await fetch(`/api/availability?${params}`, { signal: controller.signal });
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "availability_unavailable");
        return (body.slots ?? []) as Slot[];
      }),
    )
      .then((groups) => {
        if (cancelled) return;
        const now = Date.now();
        const byId = new Map<string, Slot>();
        for (const slot of groups.flat()) {
          const isoDate = bangkokDateParts(new Date(slot.starts_at)).isoDate;
          if (slot.remaining > 0 && isWithinHorizon(isoDate, today, horizonDays) && new Date(slot.starts_at).getTime() > now) {
            byId.set(slot.id, slot);
          }
        }
        const open = [...byId.values()].sort((left, right) => left.starts_at.localeCompare(right.starts_at));
        setSlots(open);
        setLoadedSlotKey(key);
        setTimeSlotId((current) => (open.some((slot) => slot.id === current) ? current : (open[0]?.id ?? "")));
      })
      .catch((error: Error) => {
        if (cancelled || error.name === "AbortError") return;
        setFormError(error.message);
        setSlots([]);
        setLoadedSlotKey(key);
        setTimeSlotId("");
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [horizonDays, officeId, ready, renewalBlocked, serviceId, slotKey, today]);

  function chooseOffice(nextOfficeId: string) {
    const nextOffice = catalog?.offices.find((item) => item.id === nextOfficeId);
    const offered = catalog ? servicesFor(catalog, categories, nextOffice) : [];
    const nextService = offered.some((item) => item.id === serviceId) ? service : (offered.find((item) => item.slug === "new-car") ?? offered[0]);
    setOfficeId(nextOfficeId);
    if (nextService && nextService.id !== serviceId) chooseService(nextService.id);
  }

  function chooseService(nextServiceId: string) {
    const nextService = catalog?.services.find((item) => item.id === nextServiceId);
    const nextCategory = categoryOf(categories, nextService);
    setServiceId(nextServiceId);
    setAnswers((current) => applicableAnswers(nextCategory, nextService?.slug ?? "", current));
    if (!nextService?.requiresVehicle) setVehicleCategory("");
  }

  function setAnswer(key: string, value: string) {
    setAnswers((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (!current[key]) return current;
      const next = { ...current };
      delete next[key];
      return next;
    });
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitLock.current || !service) return;
    setFormError("");
    const payload: BookingRequest = {
      officeId,
      serviceId,
      vehicleCategory: service.requiresVehicle ? vehicleCategory : "",
      applicantDisplayName: name.trim(),
      contactEmail: email.trim(),
      contactPhone: phone.trim(),
      notes: "",
      timeSlotId: selectedSlotId,
      acceptDisclaimer,
      idempotencyKey,
      applicantCategory,
      categorySlug: service.category,
      answers,
    };
    const parsed = bookingRequestSchema.safeParse(payload);
    const decision = validateSelection({
      officeSlug: office?.slug ?? "",
      officeActive: Boolean(office),
      serviceSlug: service.slug,
      serviceActive: true,
      requiresVehicle: service.requiresVehicle,
      category: category ?? null,
      applicantCategory,
      categorySlug: service.category,
      vehicleCategory: payload.vehicleCategory,
      answers,
      today,
    });
    const nextErrors = {
      ...(parsed.success ? {} : fieldErrorsFromZod(parsed.error)),
      ...decision.fieldErrors,
    };
    setFieldErrors(nextErrors);
    if (!parsed.success || !decision.ok) {
      setFormError(nextErrors.expiryDate ?? "validation");
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    try {
      const response = await fetch("/api/staff/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, answers: decision.answers }),
      });
      const body = await response.json();
      if (!response.ok) {
        if (body.fieldErrors) setFieldErrors(body.fieldErrors as Record<string, string>);
        setFormError(body.error ?? "server_error");
        if (body.error === "slot_full" || body.error === "slot_past" || body.error === "slot_unavailable") setSlotReload((current) => current + 1);
        return;
      }
      if (body.verificationUrl) window.sessionStorage.setItem(`vd-verify-url:${body.reference}`, body.verificationUrl);
      const added = { reference: String(body.reference), name: payload.applicantDisplayName, when: openSlots.find((slot) => slot.id === selectedSlotId)?.starts_at ?? "" };
      setLatest(added);
      setRecent((current) => [added, ...current].slice(0, 8));
      setName("");
      setEmail("");
      setPhone("");
      setFieldErrors({});
      setIdempotencyKey(crypto.randomUUID());
      setSlotReload((current) => current + 1);
      nameRef.current?.focus();
    } catch {
      setFormError("server_error");
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  }

  if (setup) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">{t.staff.signupTitle}</h1>
        <SetupRequired />
      </div>
    );
  }
  if (!catalog && !loadError) return <p className="text-sm text-muted">{t.book.loading}</p>;
  if (loadError || !catalog) return <p role="alert">{errorText(t.errors, loadError || "catalog_unavailable")}</p>;

  const slotLabel = (slot: Slot) =>
    `${formatBookingDate(slot.starts_at)} ${formatTime(slot.starts_at)}–${formatTime(slot.ends_at)} · ${slot.remaining} ${t.book.seats}`;

  return (
    <div className="space-y-4" data-testid="staff-quick-signup">
      <p className="text-xs font-semibold text-brand-dark">{DEMO_NOTICE}</p>
      <div>
        <h1 className="text-3xl font-bold">{t.staff.signupTitle}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{t.staff.signupHelp}</p>
      </div>
      {latest ? (
        <p className="rounded-2xl bg-brand-soft px-4 py-3 text-sm" role="status">
          <span className="font-semibold">{t.staff.signupAdded}.</span> {latest.name} · {latest.reference}
          {" · "}
          <Link className="font-semibold text-brand" href={`/booking-confirmation/${latest.reference}`}>
            {t.staff.signupOpen}
          </Link>
          <span className="mt-1 block text-muted">{t.staff.signupNext}</span>
        </p>
      ) : null}
      <Panel>
        <form className="space-y-4" onSubmit={onSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.book.name} error={errorText(t.errors, fieldErrors.applicantDisplayName)}>
              <input
                ref={nameRef}
                className={inputClass}
                value={name}
                autoComplete="off"
                autoFocus
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field label={`${t.book.phone} (${t.book.optional})`} error={errorText(t.errors, fieldErrors.contactPhone)}>
              <input className={inputClass} value={phone} autoComplete="off" inputMode="tel" onChange={(event) => setPhone(event.target.value)} />
            </Field>
            <Field label={`${t.book.email} (${t.book.optional})`} error={errorText(t.errors, fieldErrors.contactEmail)}>
              <input className={inputClass} value={email} autoComplete="off" inputMode="email" onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <fieldset className="space-y-2">
              <legend className="text-sm font-semibold">{t.staff.applicantCategory}</legend>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["thai", t.book.applicantThai],
                    ["foreign", t.book.applicantForeign],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className={`cursor-pointer rounded-full px-4 py-2 text-sm font-semibold ring-1 ${applicantCategory === value ? "bg-brand text-white ring-brand" : "bg-white ring-line"}`}>
                    <input className="sr-only" type="radio" name="applicantCategory" value={value} checked={applicantCategory === value} onChange={() => setApplicantCategory(value)} />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label={t.staff.office} error={errorText(t.errors, fieldErrors.officeId)}>
              <select className={inputClass} value={officeId} onChange={(event) => chooseOffice(event.target.value)}>
                {catalog.offices.map((item) => (
                  <option key={item.id} value={item.id}>
                    {locale === "th" ? item.provinceTh : item.province} · {locale === "th" ? item.nameTh : item.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t.staff.service} error={errorText(t.errors, fieldErrors.serviceId)}>
              <select className={inputClass} value={serviceId} onChange={(event) => chooseService(event.target.value)}>
                {services.map((item) => (
                  <option key={item.id} value={item.id}>
                    {locale === "th" ? item.nameTh : item.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {service?.requiresVehicle ? (
            <Field label={t.confirm.vehicle} error={errorText(t.errors, fieldErrors.vehicleCategory)}>
              <select className={inputClass} value={vehicleCategory} onChange={(event) => setVehicleCategory(event.target.value)}>
                <option value="">—</option>
                {vehicleChoices.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {locale === "th" ? item.nameTh : item.name}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          {fields.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {renewalHint ? <p className="text-sm leading-6 text-muted sm:col-span-2">{renewalHint}</p> : null}
              {fields.map((field) => (
                <Field key={field.key} label={locale === "th" ? field.labelTh : field.labelEn} hint={locale === "th" ? field.helpTh : field.helpEn} error={errorText(t.errors, fieldErrors[field.key])}>
                  {field.kind === "date" ? (
                    <input className={inputClass} type="date" value={answers[field.key] ?? ""} onChange={(event) => setAnswer(field.key, event.target.value)} />
                  ) : (
                    <select className={inputClass} value={answers[field.key] ?? ""} onChange={(event) => setAnswer(field.key, event.target.value)}>
                      <option value="">—</option>
                      {activeOptions(field).map((option) => (
                        <option key={option.value} value={option.value}>
                          {locale === "th" ? option.labelTh : option.labelEn}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
              ))}
            </div>
          ) : null}
          {renewal.state === "outside" ? <p role="alert" className="text-sm font-semibold text-full">{t.book.renewalOutside}</p> : null}
          <Field label={t.staff.signupSlot} hint={t.staff.signupSlotHint} error={errorText(t.errors, fieldErrors.timeSlotId)}>
            {slotsLoading ? <p className="text-sm text-muted">{t.book.loading}</p> : null}
            {!slotsLoading && !renewalBlocked && openSlots.length === 0 ? <p className="text-sm text-muted">{t.staff.signupNoSlots}</p> : null}
            {openSlots.length > 0 ? (
              <select className={inputClass} value={selectedSlotId} onChange={(event) => setTimeSlotId(event.target.value)}>
                {openSlots.map((slot) => (
                  <option key={slot.id} value={slot.id}>
                    {slotLabel(slot)}
                  </option>
                ))}
              </select>
            ) : null}
          </Field>
          <label className="flex items-start gap-3 text-sm">
            <input className="mt-1" type="checkbox" checked={acceptDisclaimer} onChange={(event) => setAcceptDisclaimer(event.target.checked)} />
            <span>{t.book.accept}</span>
          </label>
          {fieldErrors.acceptDisclaimer ? <p role="alert" className="text-sm text-full">{errorText(t.errors, fieldErrors.acceptDisclaimer)}</p> : null}
          {formError ? <p role="alert" className="text-sm font-semibold text-full">{errorText(t.errors, formError)}</p> : null}
          <Button type="submit" disabled={submitting || slotsLoading || !selectedSlotId}>
            {submitting ? t.staff.signupAdding : t.staff.signupAdd}
          </Button>
        </form>
      </Panel>
      {recent.length > 0 ? (
        <Panel>
          <h2 className="text-lg font-bold">{t.staff.signupRecent}</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {recent.map((item) => (
              <li key={item.reference}>
                <Link className="font-semibold text-brand" href={`/booking-confirmation/${item.reference}`}>
                  {item.reference}
                </Link>
                <span className="text-muted"> · {item.name}{item.when ? ` · ${formatBookingDate(item.when)} ${formatTime(item.when)}` : ""}</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}
