"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { errorText, SetupRequired, useI18n } from "@/components/language";
import { MonthCalendar, type DayState } from "@/components/booking/month-calendar";
import { Button, Field, Panel, inputClass } from "@/components/ui";
import { bookingRequestSchema, type BookingRequest } from "@/lib/booking/validation";
import { SAMPLE_GUIDANCE_NOTE } from "@/lib/demo-notice";
import { bangkokDateParts, formatTime } from "@/lib/time";
import type { CatalogOffice, CatalogService, CatalogVehicle, DocumentGuidance } from "@/lib/data/store";

type Catalog = { offices: CatalogOffice[]; services: CatalogService[]; vehicles: CatalogVehicle[] };
type Slot = { id: string; starts_at: string; ends_at: string; capacity: number; remaining: number };
type StepId = "office" | "category" | "service" | "vehicle" | "applicant" | "documents" | "schedule" | "review";

const empty: BookingRequest = {
  officeId: "",
  serviceId: "",
  vehicleCategory: "",
  applicantDisplayName: "",
  contactEmail: "",
  contactPhone: "",
  notes: "",
  timeSlotId: "",
  acceptDisclaimer: false,
  idempotencyKey: "",
};

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function BookingWizard() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [setup, setSetup] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [stepIndex, setStepIndex] = useState(0);
  const [monthKey, setMonthKey] = useState(bangkokDateParts().monthKey);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const form = useForm<BookingRequest>({
    resolver: zodResolver(bookingRequestSchema),
    defaultValues: empty,
    mode: "onSubmit",
  });
  const values = form.watch();

  useEffect(() => {
    const savedKey = window.sessionStorage.getItem("vd-idempotency");
    const idempotencyKey = savedKey && savedKey.length > 20 ? savedKey : crypto.randomUUID();
    window.sessionStorage.setItem("vd-idempotency", idempotencyKey);
    const draft = window.sessionStorage.getItem("vd-draft");
    if (draft) {
      try {
        form.reset({ ...empty, ...JSON.parse(draft), idempotencyKey });
        return;
      } catch {
        window.sessionStorage.removeItem("vd-draft");
      }
    }
    form.setValue("idempotencyKey", idempotencyKey);
  }, [form]);

  useEffect(() => {
    if (!values.idempotencyKey) return;
    window.sessionStorage.setItem("vd-draft", JSON.stringify(values));
  }, [values]);

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

  const service = catalog?.services.find((item) => item.id === values.serviceId);
  const steps = useMemo(() => {
    const all: StepId[] = ["office", "category", "service", "vehicle", "applicant", "documents", "schedule", "review"];
    return service?.requiresVehicle === false ? all.filter((step) => step !== "vehicle") : all;
  }, [service?.requiresVehicle]);
  const step = steps[stepIndex] ?? "office";
  const today = bangkokDateParts().isoDate;
  const maxMonth = shiftMonth(bangkokDateParts().monthKey, 3);

  useEffect(() => {
    if (step !== "schedule" || !values.officeId || !values.serviceId) return;
    const controller = new AbortController();
    setSlotsLoading(true);
    const params = new URLSearchParams({ officeId: values.officeId, serviceId: values.serviceId, month: monthKey });
    fetch(`/api/availability?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "availability_unavailable");
        setSlots(body.slots ?? []);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") setFormError(error.message);
      })
      .finally(() => setSlotsLoading(false));
    return () => controller.abort();
  }, [step, values.officeId, values.serviceId, monthKey]);

  const [categoryId, setCategoryId] = useState("");
  const [chosenSlot, setChosenSlot] = useState<Slot | null>(null);
  const categories = useMemo(() => {
    const map = new Map<string, { id: string; name: string; nameTh: string }>();
    for (const item of catalog?.services ?? []) {
      if (!map.has(item.category)) {
        map.set(item.category, {
          id: item.category,
          name: CATEGORY_EN[item.category] ?? item.category,
          nameTh: item.categoryTh,
        });
      }
    }
    return [...map.values()];
  }, [catalog]);
  useEffect(() => {
    const match = catalog?.services.find((item) => item.id === values.serviceId);
    if (match) setCategoryId(match.category);
  }, [catalog, values.serviceId]);

  const dayStates: Record<string, DayState> = {};
  for (const slot of slots) {
    const isoDate = bangkokDateParts(new Date(slot.starts_at)).isoDate;
    const open = slot.remaining > 0 && new Date(slot.starts_at).getTime() > Date.now();
    const current = dayStates[isoDate];
    if (open) dayStates[isoDate] = "available";
    else if (current !== "available") dayStates[isoDate] = slot.remaining <= 0 ? "full" : "unavailable";
  }

  async function next() {
    setFormError("");
    const fields = fieldsFor(step);
    if (fields.length) {
      const valid = await form.trigger(fields);
      if (!valid) return;
    }
    if (step === "vehicle" && service?.requiresVehicle && !values.vehicleCategory) {
      form.setError("vehicleCategory", { message: "vehicle_required" });
      return;
    }
    if (step === "schedule" && !values.timeSlotId) {
      form.setError("timeSlotId", { message: "invalid_id" });
      return;
    }
    setStepIndex((index) => Math.min(index + 1, steps.length - 1));
  }

  async function submit() {
    setFormError("");
    setSubmitting(true);
    const payload = form.getValues();
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        if (body.fieldErrors) {
          for (const [field, code] of Object.entries(body.fieldErrors as Record<string, string>)) {
            form.setError(field as keyof BookingRequest, { message: code });
          }
        }
        setFormError(body.error ?? "server_error");
        return;
      }
      if (body.token) window.sessionStorage.setItem(`vd-token:${body.reference}`, body.token);
      if (body.verificationUrl) window.sessionStorage.setItem(`vd-verify-url:${body.reference}`, body.verificationUrl);
      window.sessionStorage.removeItem("vd-draft");
      window.sessionStorage.removeItem("vd-idempotency");
      router.push(`/booking/${body.reference}`);
    } catch {
      setFormError("server_error");
    } finally {
      setSubmitting(false);
    }
  }

  if (setup) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t.book.title}</h1>
        <SetupRequired />
      </div>
    );
  }
  if (!catalog && !loadError) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">{t.book.title}</h1>
        <p className="text-sm text-muted">{t.book.loading}</p>
      </div>
    );
  }
  if (loadError) return <p role="alert">{errorText(t.errors, loadError)}</p>;

  const office = catalog?.offices.find((item) => item.id === values.officeId);
  const slot = chosenSlot?.id === values.timeSlotId ? chosenSlot : slots.find((item) => item.id === values.timeSlotId);
  const guidance: DocumentGuidance | undefined = service?.documentGuidance;
  const visibleServices = catalog?.services.filter((item) => item.category === categoryId) ?? [];
  const daySlots = slots.filter((item) => bangkokDateParts(new Date(item.starts_at)).isoDate === selectedDate);

  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <ol className="no-print flex gap-2 overflow-x-auto lg:flex-col" aria-label="Progress">
        {steps.map((item, index) => {
          const complete = index < stepIndex;
          const current = index === stepIndex;
          return (
            <li key={item}>
              <button
                type="button"
                className={`flex min-w-36 items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm lg:w-full ${current ? "bg-white shadow-sm ring-1 ring-line" : ""}`}
                onClick={() => {
                  if (index < stepIndex) setStepIndex(index);
                }}
                disabled={index > stepIndex}
                aria-current={current ? "step" : undefined}
              >
                <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${complete || current ? "bg-brand text-white" : "bg-line text-muted"}`}>
                  {complete ? "✓" : index + 1}
                </span>
                <span className="font-semibold">{t.book.steps[item]}</span>
              </button>
            </li>
          );
        })}
      </ol>
      <Panel>
        <h1 className="text-2xl font-bold">{t.book.title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">{helpFor(step, t)}</p>
        <div className="mt-6 space-y-4">
          {step === "office"
            ? catalog?.offices.map((item) => (
                <Choice
                  key={item.id}
                  name="office"
                  checked={values.officeId === item.id}
                  title={locale === "th" ? item.nameTh : item.name}
                  detail={`${locale === "th" ? item.provinceTh : item.province} · ${item.demoLabel}`}
                  onSelect={() => {
                    form.setValue("officeId", item.id);
                    form.setValue("serviceId", "");
                    form.setValue("timeSlotId", "");
                    setCategoryId("");
                  }}
                />
              ))
            : null}
          {step === "category"
            ? categories.map((item) => (
                <Choice
                  key={item.id}
                  name="category"
                  checked={categoryId === item.id}
                  title={locale === "th" ? item.nameTh : item.name}
                  detail={t.book.categoryHelp}
                  onSelect={() => {
                    setCategoryId(item.id);
                    form.setValue("serviceId", "");
                    form.setValue("timeSlotId", "");
                  }}
                />
              ))
            : null}
          {step === "service"
            ? visibleServices.map((item) => (
                <Choice
                  key={item.id}
                  name="service"
                  checked={values.serviceId === item.id}
                  title={locale === "th" ? item.nameTh : item.name}
                  detail={item.requiresVehicle ? t.book.vehicleHelp : t.book.serviceHelp}
                  onSelect={() => {
                    form.setValue("serviceId", item.id);
                    form.setValue("vehicleCategory", "");
                    form.setValue("timeSlotId", "");
                  }}
                />
              ))
            : null}
          {step === "vehicle"
            ? catalog?.vehicles.map((item) => (
                <Choice
                  key={item.slug}
                  name="vehicle"
                  checked={values.vehicleCategory === item.slug}
                  title={locale === "th" ? item.nameTh : item.name}
                  detail={t.book.vehicleHelp}
                  onSelect={() => form.setValue("vehicleCategory", item.slug)}
                />
              ))
            : null}
          {step === "applicant" ? (
            <div className="grid gap-4">
              <Field label={t.book.name} error={errorText(t.errors, form.formState.errors.applicantDisplayName?.message)}>
                <input className={inputClass} {...form.register("applicantDisplayName")} autoComplete="name" />
              </Field>
              <Field label={`${t.book.email} (${t.book.optional})`} error={errorText(t.errors, form.formState.errors.contactEmail?.message)}>
                <input className={inputClass} {...form.register("contactEmail")} autoComplete="email" inputMode="email" />
              </Field>
              <Field label={`${t.book.phone} (${t.book.optional})`} error={errorText(t.errors, form.formState.errors.contactPhone?.message)}>
                <input className={inputClass} {...form.register("contactPhone")} autoComplete="tel" inputMode="tel" />
              </Field>
              <Field label={`${t.book.notes} (${t.book.optional})`} error={errorText(t.errors, form.formState.errors.notes?.message)}>
                <textarea className={inputClass} rows={3} {...form.register("notes")} />
              </Field>
            </div>
          ) : null}
          {step === "documents" && guidance ? (
            <div className="space-y-3 text-sm leading-6">
              <p className="font-semibold text-brand-dark">{SAMPLE_GUIDANCE_NOTE}</p>
              <p>{locale === "th" ? guidance.summaryTh : guidance.summaryEn}</p>
              <ol className="list-decimal space-y-2 pl-5">
                {guidance.items.map((item) => (
                  <li key={item.en}>{locale === "th" ? item.th : item.en}</li>
                ))}
              </ol>
            </div>
          ) : null}
          {step === "schedule" ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <MonthCalendar
                monthKey={monthKey}
                today={today}
                selectedDate={selectedDate}
                days={dayStates}
                canPrev={monthKey > today.slice(0, 7)}
                canNext={monthKey < maxMonth}
                onMonth={(delta) => {
                  setMonthKey((current) => shiftMonth(current, delta));
                  setSelectedDate("");
                }}
                onSelect={setSelectedDate}
              />
              <div>
                {slotsLoading ? <p>{t.book.submitting}</p> : null}
                {!selectedDate ? <p className="text-sm text-muted">{t.calendar.pickDay}</p> : null}
                <div className="grid gap-2">
                  {daySlots.map((item) => {
                    const closed = item.remaining <= 0 || new Date(item.starts_at).getTime() <= Date.now();
                    return (
                      <button
                        key={item.id}
                        type="button"
                        disabled={closed}
                        aria-pressed={values.timeSlotId === item.id}
                        onClick={() => {
                          form.setValue("timeSlotId", item.id);
                          setChosenSlot(item);
                        }}
                        className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold disabled:opacity-50 ${values.timeSlotId === item.id ? "border-brand bg-brand-soft" : "border-line"}`}
                      >
                        {formatTime(item.starts_at)}–{formatTime(item.ends_at)} · {closed ? t.book.full : `${item.remaining} ${t.book.seats}`}
                      </button>
                    );
                  })}
                </div>
                {form.formState.errors.timeSlotId ? <p role="alert" className="mt-2 text-sm text-full">{errorText(t.errors, form.formState.errors.timeSlotId.message)}</p> : null}
              </div>
            </div>
          ) : null}
          {step === "review" ? (
            <div className="space-y-3 text-sm leading-6">
              <Review label={t.staff.office} value={office ? `${locale === "th" ? office.nameTh : office.name} — ${office.demoLabel}` : ""} />
              <Review label={t.staff.service} value={service ? (locale === "th" ? service.nameTh : service.name) : ""} />
              <Review label={t.book.name} value={values.applicantDisplayName} />
              <Review label={t.staff.date} value={slot ? `${bangkokDateParts(new Date(slot.starts_at)).isoDate} ${formatTime(slot.starts_at)}–${formatTime(slot.ends_at)}` : values.timeSlotId} />
              <label className="mt-4 flex items-start gap-3 rounded-2xl bg-brand-soft p-4">
                <input type="checkbox" className="mt-1" {...form.register("acceptDisclaimer")} />
                <span>{t.book.accept}</span>
              </label>
              {form.formState.errors.acceptDisclaimer ? <p role="alert" className="text-sm text-full">{errorText(t.errors, form.formState.errors.acceptDisclaimer.message)}</p> : null}
            </div>
          ) : null}
        </div>
        {formError ? <p role="alert" className="mt-4 text-sm font-semibold text-full">{errorText(t.errors, formError)}</p> : null}
        <div className="mt-6 flex flex-wrap justify-between gap-3">
          <Button type="button" variant="secondary" onClick={() => setStepIndex((index) => Math.max(0, index - 1))} disabled={stepIndex === 0 || submitting}>
            {t.actions.back}
          </Button>
          {step === "review" ? (
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? t.book.submitting : t.actions.confirmBooking}
            </Button>
          ) : (
            <Button type="button" onClick={next} disabled={(step === "category" && !categoryId) || (step === "service" && visibleServices.length === 0)}>
              {t.actions.continue}
            </Button>
          )}
        </div>
      </Panel>
    </div>
  );
}

function fieldsFor(step: StepId): (keyof BookingRequest)[] {
  if (step === "office") return ["officeId"];
  if (step === "service") return ["serviceId"];
  if (step === "applicant") return ["applicantDisplayName", "contactEmail", "contactPhone", "notes"];
  if (step === "review") return ["acceptDisclaimer"];
  return [];
}

function helpFor(step: StepId, t: ReturnType<typeof useI18n>["t"]) {
  const help = {
    office: t.book.officeHelp,
    category: t.book.categoryHelp,
    service: t.book.serviceHelp,
    vehicle: t.book.vehicleHelp,
    applicant: t.book.applicantHelp,
    documents: t.book.documentsHelp,
    schedule: t.book.scheduleHelp,
    review: t.book.reviewHelp,
  } satisfies Record<StepId, string>;
  return help[step];
}

function Choice({
  name,
  checked,
  title,
  detail,
  onSelect,
}: {
  name: string;
  checked: boolean;
  title: string;
  detail: string;
  onSelect: () => void;
}) {
  return (
    <label className={`block cursor-pointer rounded-2xl border px-4 py-3 ${checked ? "border-brand bg-brand-soft" : "border-line"}`}>
      <input className="mr-3" type="radio" name={name} checked={checked} onChange={onSelect} />
      <span className="font-semibold">{title}</span>
      <span className="mt-1 block pl-6 text-sm text-muted">{detail}</span>
    </label>
  );
}

function Review({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="block text-xs font-semibold uppercase tracking-wide text-muted">{label}</span>
      <span className="font-semibold">{value}</span>
    </p>
  );
}

const CATEGORY_EN: Record<string, string> = {
  new_licence: "New driving licence",
  renewal: "Driving licence renewal",
  conversion: "Foreign licence conversion",
  vehicle: "Vehicle-related services",
  other: "Other demo services",
};
