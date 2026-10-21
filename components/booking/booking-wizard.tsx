"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { MonthCalendar, type DayState } from "@/components/booking/month-calendar";
import { DocumentGuidance } from "@/components/booking/document-guidance";
import { errorText, SetupRequired, useI18n } from "@/components/language";
import { Button, Field, Panel, inputClass } from "@/components/ui";
import {
  activeOptions,
  answerLabel,
  applicableAnswers,
  bookingCategorySeed,
  buildWizardSteps,
  describeRenewalRules,
  evaluateRenewal,
  hasConditionalQuestions,
  inferLicenceClass,
  isWithinHorizon,
  selectDocumentSet,
  todayBangkok,
  validateSelection,
  visibleFields,
  type BookingCategory,
  type WizardStepId,
} from "@/lib/booking/categories";
import { bookingRequestSchema, type BookingRequest } from "@/lib/booking/validation";
import { DEMO_NOTICE } from "@/lib/demo-notice";
import { bangkokDateParts, formatTime, shiftIsoDate } from "@/lib/time";
import type { CatalogOffice, CatalogService, CatalogVehicle } from "@/lib/data/store";

type Catalog = {
  offices: CatalogOffice[];
  services: CatalogService[];
  vehicles: CatalogVehicle[];
  categories?: BookingCategory[];
};
type Slot = { id: string; starts_at: string; ends_at: string; capacity: number; remaining: number };

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
  applicantCategory: "",
  categorySlug: "",
  answers: {},
};

function shiftMonth(monthKey: string, delta: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function slotIsPast(startsAt: string, now: number) {
  return new Date(startsAt).getTime() <= now;
}

export function BookingWizard() {
  const { locale, t } = useI18n();
  const router = useRouter();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [setup, setSetup] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [stepId, setStepId] = useState<WizardStepId>("applicantCategory");
  const [monthKey, setMonthKey] = useState(bangkokDateParts().monthKey);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadedSlotKey, setLoadedSlotKey] = useState("");
  const [nowMs, setNowMs] = useState(0);
  const [selectedDate, setSelectedDate] = useState("");
  const [chosenSlot, setChosenSlot] = useState<Slot | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [answerErrors, setAnswerErrors] = useState<Record<string, string>>({});
  const submitLock = useRef(false);

  const form = useForm<BookingRequest>({
    resolver: zodResolver(bookingRequestSchema),
    defaultValues: empty,
    mode: "onSubmit",
  });
  const values = useWatch({ control: form.control, defaultValue: empty }) as BookingRequest;

  useEffect(() => {
    const savedKey = window.sessionStorage.getItem("vd-idempotency");
    const idempotencyKey = savedKey && savedKey.length > 20 ? savedKey : crypto.randomUUID();
    window.sessionStorage.setItem("vd-idempotency", idempotencyKey);
    const draft = window.sessionStorage.getItem("vd-draft");
    if (draft) {
      try {
        const parsed = JSON.parse(draft) as Partial<BookingRequest>;
        form.reset({ ...empty, ...parsed, answers: parsed.answers ?? {}, idempotencyKey });
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

  const categories = useMemo(() => {
    const rows = catalog?.categories?.length ? catalog.categories : bookingCategorySeed;
    return [...rows].filter((item) => item.active).sort((left, right) => left.sortOrder - right.sortOrder);
  }, [catalog]);
  const category = categories.find((item) => item.slug === values.categorySlug);
  const service = catalog?.services.find((item) => item.id === values.serviceId);
  const office = catalog?.offices.find((item) => item.id === values.officeId);
  const questions = hasConditionalQuestions(category, service?.slug ?? "");
  const steps = buildWizardSteps({ requiresVehicle: Boolean(service?.requiresVehicle), hasQuestions: questions });
  const step = steps.includes(stepId) ? stepId : "applicant";
  const stepIndex = Math.max(0, steps.indexOf(step));
  const today = todayBangkok();
  const horizonDays = category?.slotRules.horizonDays ?? 21;
  const maxMonth = shiftIsoDate(today, horizonDays).slice(0, 7);
  const renewal = category ? evaluateRenewal(category, values.answers, today) : { state: "not_applicable" as const };
  const renewalBlocked = renewal.state === "outside" || renewal.state === "invalid_date" || renewal.state === "missing";

  const slotRequestKey = `${values.officeId}|${values.serviceId}|${monthKey}`;
  const slotsReady = loadedSlotKey === slotRequestKey;
  const slotsLoading = step === "schedule" && !renewalBlocked && Boolean(values.officeId && values.serviceId) && !slotsReady;
  const visibleSlots = slotsReady ? slots : [];

  useEffect(() => {
    if (step !== "schedule" || !values.officeId || !values.serviceId || renewalBlocked) return;
    const controller = new AbortController();
    const key = `${values.officeId}|${values.serviceId}|${monthKey}`;
    const params = new URLSearchParams({ officeId: values.officeId, serviceId: values.serviceId, month: monthKey });
    fetch(`/api/availability?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "availability_unavailable");
        setNowMs(Date.now());
        setSlots(body.slots ?? []);
        setLoadedSlotKey(key);
      })
      .catch((error: Error) => {
        if (error.name !== "AbortError") {
          setFormError(error.message);
          setSlots([]);
          setLoadedSlotKey(key);
        }
      });
    return () => controller.abort();
  }, [step, values.officeId, values.serviceId, monthKey, renewalBlocked]);

  const openSlots = visibleSlots.filter((slot) => {
    const isoDate = bangkokDateParts(new Date(slot.starts_at)).isoDate;
    return isWithinHorizon(isoDate, today, horizonDays) && !slotIsPast(slot.starts_at, nowMs);
  });
  const dayStates: Record<string, DayState> = {};
  for (const slot of visibleSlots) {
    const isoDate = bangkokDateParts(new Date(slot.starts_at)).isoDate;
    if (!isWithinHorizon(isoDate, today, horizonDays)) continue;
    const open = slot.remaining > 0 && !slotIsPast(slot.starts_at, nowMs);
    const current = dayStates[isoDate];
    if (open) dayStates[isoDate] = "available";
    else if (current !== "available") dayStates[isoDate] = slot.remaining <= 0 ? "full" : "unavailable";
  }

  const visibleServices = catalog?.services.filter((item) => item.category === values.categorySlug) ?? [];
  const vehicleChoices = (catalog?.vehicles ?? []).filter((item) => !category?.vehicleSlugs.length || category.vehicleSlugs.includes(item.slug));
  const fields = category ? visibleFields(category, service?.slug ?? "") : [];
  const guidance = category
    ? selectDocumentSet(category, {
        applicantCategory: values.applicantCategory,
        serviceSlug: service?.slug ?? "",
        licenceClass: inferLicenceClass(service?.slug ?? "", values.answers, values.vehicleCategory),
        licenceType: values.answers.currentLicenceType ?? "",
      })
    : undefined;
  const slot = chosenSlot?.id === values.timeSlotId ? chosenSlot : slots.find((item) => item.id === values.timeSlotId);
  const daySlots = openSlots.filter((item) => bangkokDateParts(new Date(item.starts_at)).isoDate === selectedDate);
  const provinces = groupOffices(catalog?.offices ?? [], locale);

  function selectionInput() {
    return {
      officeSlug: office?.slug ?? "",
      officeActive: true,
      serviceSlug: service?.slug ?? "",
      serviceActive: true,
      requiresVehicle: Boolean(service?.requiresVehicle),
      category: category ?? null,
      applicantCategory: values.applicantCategory,
      categorySlug: values.categorySlug,
      vehicleCategory: values.vehicleCategory,
      answers: values.answers,
      today,
    };
  }

  function setAnswer(key: string, value: string) {
    const next = { ...form.getValues("answers"), [key]: value };
    if (!value) delete next[key];
    form.setValue("answers", next);
    if (category && evaluateRenewal(category, next, today).state === "outside") {
      form.setValue("timeSlotId", "");
    }
    setAnswerErrors((current) => {
      const rest = { ...current };
      delete rest[key];
      return rest;
    });
  }

  async function next() {
    setFormError("");
    const schemaFields = fieldsFor(step);
    if (schemaFields.length) {
      const valid = await form.trigger(schemaFields);
      if (!valid) return;
    }
    if (step === "category" && !category) return;
    if (step === "service" && !visibleServices.some((item) => item.id === values.serviceId)) return;
    if (step === "vehicle" && service?.requiresVehicle && !values.vehicleCategory) {
      form.setError("vehicleCategory", { message: "vehicle_required" });
      return;
    }
    if (step === "questions" || (step === "schedule" && questions)) {
      const decision = validateSelection(selectionInput());
      setAnswerErrors(decision.fieldErrors);
      if (!decision.ok) return;
      form.setValue("answers", decision.answers);
    }
    if (step === "schedule") {
      if (renewal.state === "outside") {
        setFormError("renewal_window");
        return;
      }
      if (!values.timeSlotId || !slot) {
        form.setError("timeSlotId", { message: "invalid_id" });
        return;
      }
      const isoDate = bangkokDateParts(new Date(slot.starts_at)).isoDate;
      if (!isWithinHorizon(isoDate, today, horizonDays) || slotIsPast(slot.starts_at, nowMs)) {
        form.setError("timeSlotId", { message: "slot_past" });
        return;
      }
    }
    const nextStep = steps[Math.min(stepIndex + 1, steps.length - 1)];
    if (nextStep) setStepId(nextStep);
  }

  async function submit() {
    if (submitLock.current) return;
    setFormError("");
    const decision = validateSelection(selectionInput());
    setAnswerErrors(decision.fieldErrors);
    if (!decision.ok) {
      setFormError(decision.fieldErrors.expiryDate ?? "validation");
      return;
    }
    const valid = await form.trigger();
    if (!valid) return;
    submitLock.current = true;
    setSubmitting(true);
    const payload = { ...form.getValues(), answers: decision.answers };
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        if (body.fieldErrors) {
          setAnswerErrors(body.fieldErrors as Record<string, string>);
          for (const [field, code] of Object.entries(body.fieldErrors as Record<string, string>)) {
            if (field in empty) form.setError(field as keyof BookingRequest, { message: code });
          }
        }
        setFormError(body.error ?? "server_error");
        return;
      }
      if (body.verificationUrl) window.sessionStorage.setItem(`vd-verify-url:${body.reference}`, body.verificationUrl);
      window.sessionStorage.removeItem("vd-draft");
      window.sessionStorage.removeItem("vd-idempotency");
      router.push(`/booking-confirmation/${body.reference}`);
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
  if (loadError || !catalog) return <p role="alert">{errorText(t.errors, loadError)}</p>;

  const eligibleCategories = office ? categories.filter((item) => item.eligibleOfficeSlugs.includes(office.slug)) : categories;

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
      <div className="no-print">
        <p className="mb-3 text-sm font-semibold lg:hidden" data-testid="wizard-compact-progress">
          {stepIndex + 1} / {steps.length} · {t.book.steps[step]}
        </p>
        <ol className="flex flex-col gap-1" aria-label="Progress" data-testid="wizard-steps">
          {steps.map((item, index) => {
            const complete = index < stepIndex;
            const current = item === step;
            return (
              <li key={item}>
                <button
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2 text-left text-sm ${current ? "bg-white shadow-sm ring-1 ring-line" : ""}`}
                  onClick={() => {
                    if (index < stepIndex) setStepId(item);
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
      </div>
      <Panel>
        <p className="text-xs font-semibold text-brand-dark" data-testid="wizard-disclaimer">
          {DEMO_NOTICE}
        </p>
        <h1 className="mt-2 text-2xl font-bold">{t.book.title}</h1>
        <p className="mt-2 text-sm leading-6 text-muted">{helpFor(step, t)}</p>
        {office && step !== "applicantCategory" && step !== "office" ? (
          <p className="mt-4 rounded-2xl bg-paper px-4 py-3 text-sm" data-testid="selection-summary">
            <span className="font-semibold">{locale === "th" ? office.nameTh : office.name}</span>
            <span className="text-muted"> · {office.demoLabel}</span>
            {service ? <span className="mt-1 block font-semibold">{locale === "th" ? service.nameTh : service.name}</span> : null}
            {category ? <span className="block text-muted">{locale === "th" ? category.nameTh : category.name}</span> : null}
          </p>
        ) : null}
        <div className="mt-6 space-y-4" data-testid={`wizard-panel-${step}`}>
          {step === "applicantCategory" ? (
            <>
              <Choice
                name="applicant"
                checked={values.applicantCategory === "thai"}
                title={t.book.applicantThai}
                detail={t.book.applicantThaiBody}
                onSelect={() => form.setValue("applicantCategory", "thai")}
              />
              <Choice
                name="applicant"
                checked={values.applicantCategory === "foreign"}
                title={t.book.applicantForeign}
                detail={t.book.applicantForeignBody}
                onSelect={() => form.setValue("applicantCategory", "foreign")}
              />
              {form.formState.errors.applicantCategory ? (
                <p role="alert" className="text-sm text-full">{errorText(t.errors, form.formState.errors.applicantCategory.message)}</p>
              ) : null}
            </>
          ) : null}
          {step === "office"
            ? provinces.map((group) => (
                <section key={group.province} className="space-y-3">
                  <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{group.province}</h2>
                  {group.offices.map((item) => (
                    <Choice
                      key={item.id}
                      name="office"
                      checked={values.officeId === item.id}
                      title={locale === "th" ? item.nameTh : item.name}
                      detail={item.demoLabel}
                      onSelect={() => {
                        const nextOffice = item;
                        const current = categories.find((entry) => entry.slug === values.categorySlug);
                        form.setValue("officeId", nextOffice.id);
                        form.setValue("timeSlotId", "");
                        setSelectedDate("");
                        if (current && !current.eligibleOfficeSlugs.includes(nextOffice.slug)) {
                          form.setValue("categorySlug", "");
                          form.setValue("serviceId", "");
                          form.setValue("vehicleCategory", "");
                          form.setValue("answers", {});
                        }
                      }}
                    />
                  ))}
                </section>
              ))
            : null}
          {step === "category" ? (
            eligibleCategories.length === 0 ? (
              <p className="text-sm text-muted">{t.book.emptyCategories}</p>
            ) : (
              eligibleCategories.map((item) => (
                <Choice
                  key={item.slug}
                  name="category"
                  checked={values.categorySlug === item.slug}
                  title={locale === "th" ? item.nameTh : item.name}
                  detail={locale === "th" ? item.descriptionTh : item.description}
                  icon={item.icon}
                  onSelect={() => {
                    if (values.categorySlug === item.slug) return;
                    form.setValue("categorySlug", item.slug);
                    form.setValue("serviceId", "");
                    form.setValue("vehicleCategory", "");
                    form.setValue("timeSlotId", "");
                    form.setValue("answers", applicableAnswers(item, "", values.answers));
                    setSelectedDate("");
                    setAnswerErrors({});
                  }}
                />
              ))
            )
          ) : null}
          {step === "service" ? (
            visibleServices.length === 0 ? (
              <p className="text-sm text-muted">{t.book.emptyServices}</p>
            ) : (
              visibleServices.map((item) => (
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
                    form.setValue("answers", applicableAnswers(category, item.slug, values.answers));
                    setSelectedDate("");
                    setAnswerErrors({});
                  }}
                />
              ))
            )
          ) : null}
          {step === "vehicle"
            ? vehicleChoices.map((item) => (
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
          {step === "questions" ? (
            <div className="grid gap-4">
              {category && describeRenewalRules(category.slotRules, locale) ? (
                <p className="text-sm leading-6 text-muted">{describeRenewalRules(category.slotRules, locale)}</p>
              ) : null}
              {fields.map((field) => {
                const label = locale === "th" ? field.labelTh : field.labelEn;
                const help = locale === "th" ? field.helpTh : field.helpEn;
                const value = values.answers[field.key] ?? "";
                return (
                  <Field key={field.key} label={label} hint={help} error={errorText(t.errors, answerErrors[field.key])}>
                    {field.kind === "date" ? (
                      <input
                        className={inputClass}
                        type="date"
                        value={value}
                        onChange={(event) => setAnswer(field.key, event.target.value)}
                      />
                    ) : (
                      <select className={inputClass} value={value} onChange={(event) => setAnswer(field.key, event.target.value)}>
                        <option value="">—</option>
                        {activeOptions(field).map((option) => (
                          <option key={option.value} value={option.value}>
                            {locale === "th" ? option.labelTh : option.labelEn}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                );
              })}
              {renewal.state === "outside" ? <p role="alert" className="text-sm font-semibold text-full">{t.book.renewalOutside}</p> : null}
            </div>
          ) : null}
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
          {step === "documents" && guidance ? <DocumentGuidance set={guidance} /> : null}
          {step === "schedule" ? (
            renewal.state === "outside" ? (
              <p role="alert" className="text-sm font-semibold text-full">{t.book.renewalOutside}</p>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <p className="mb-3 text-sm font-semibold text-muted">{t.book.bangkokClock}</p>
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
                </div>
                <div>
                  {slotsLoading ? <p>{t.book.loading}</p> : null}
                  {!slotsLoading && slots.length === 0 ? <p className="text-sm text-muted">{t.calendar.empty}</p> : null}
                  {!slotsLoading && slots.length > 0 && openSlots.length === 0 ? <p className="text-sm text-muted">{t.calendar.outsideWindow}</p> : null}
                  {!selectedDate && openSlots.length > 0 ? <p className="text-sm text-muted">{t.calendar.pickDay}</p> : null}
                  <div className="grid gap-2">
                    {daySlots.map((item) => {
                      const closed = item.remaining <= 0 || slotIsPast(item.starts_at, nowMs);
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
                  {slot ? (
                    <p className="mt-4 text-sm font-semibold" data-testid="selected-slot">
                      {t.book.selectedSlot}: {bangkokDateParts(new Date(slot.starts_at)).isoDate} {formatTime(slot.starts_at)}–{formatTime(slot.ends_at)}
                    </p>
                  ) : null}
                  {form.formState.errors.timeSlotId ? <p role="alert" className="mt-2 text-sm text-full">{errorText(t.errors, form.formState.errors.timeSlotId.message)}</p> : null}
                </div>
              </div>
            )
          ) : null}
          {step === "review" ? (
            <div className="space-y-3 text-sm leading-6">
              <Review label={t.book.name} value={values.applicantDisplayName} />
              <Review label={t.confirm.applicantCategory} value={values.applicantCategory === "foreign" ? t.book.applicantForeign : t.book.applicantThai} />
              <Review label={t.staff.office} value={office ? `${locale === "th" ? office.nameTh : office.name} — ${office.demoLabel}` : ""} />
              <Review label={t.confirm.category} value={category ? (locale === "th" ? category.nameTh : category.name) : ""} />
              <Review label={t.staff.service} value={service ? (locale === "th" ? service.nameTh : service.name) : ""} />
              {values.vehicleCategory ? <Review label={t.confirm.vehicle} value={vehicleLabel(vehicleChoices, values.vehicleCategory, locale)} /> : null}
              {Object.entries(values.answers).map(([key, value]) => {
                const labelled = answerLabel(category, key, value, locale);
                return <Review key={key} label={labelled.label} value={labelled.value} />;
              })}
              <Review label={t.staff.date} value={slot ? `${bangkokDateParts(new Date(slot.starts_at)).isoDate} ${formatTime(slot.starts_at)}–${formatTime(slot.ends_at)}` : ""} />
              {guidance ? (
                <div className="pt-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t.confirm.guidance}</p>
                  <DocumentGuidance set={guidance} />
                </div>
              ) : null}
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
          <Button type="button" variant="secondary" onClick={() => setStepId(steps[Math.max(0, stepIndex - 1)] ?? "applicantCategory")} disabled={stepIndex === 0 || submitting}>
            {t.actions.back}
          </Button>
          {step === "review" ? (
            <Button type="button" onClick={submit} disabled={submitting}>
              {submitting ? t.book.submitting : t.actions.confirmBooking}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={next}
              disabled={
                (step === "category" && !values.categorySlug) ||
                (step === "service" && visibleServices.length === 0) ||
                (step === "schedule" && renewal.state === "outside")
              }
            >
              {t.actions.continue}
            </Button>
          )}
        </div>
      </Panel>
    </div>
  );
}

function fieldsFor(step: WizardStepId): (keyof BookingRequest)[] {
  if (step === "applicantCategory") return ["applicantCategory"];
  if (step === "office") return ["officeId"];
  if (step === "service") return ["serviceId"];
  if (step === "applicant") return ["applicantDisplayName", "contactEmail", "contactPhone", "notes"];
  if (step === "review") return ["acceptDisclaimer"];
  return [];
}

function helpFor(step: WizardStepId, t: ReturnType<typeof useI18n>["t"]) {
  const help = {
    applicantCategory: t.book.applicantCategoryHelp,
    office: t.book.officeHelp,
    category: t.book.categoryHelp,
    service: t.book.serviceHelp,
    vehicle: t.book.vehicleHelp,
    questions: t.book.questionsHelp,
    applicant: t.book.applicantHelp,
    documents: t.book.documentsHelp,
    schedule: t.book.scheduleHelp,
    review: t.book.reviewHelp,
  } satisfies Record<WizardStepId, string>;
  return help[step];
}

function groupOffices(offices: CatalogOffice[], locale: "en" | "th") {
  const groups = new Map<string, CatalogOffice[]>();
  for (const office of offices) {
    const province = locale === "th" ? office.provinceTh : office.province;
    groups.set(province, [...(groups.get(province) ?? []), office]);
  }
  return [...groups.entries()].map(([province, rows]) => ({ province, offices: rows }));
}

function vehicleLabel(vehicles: CatalogVehicle[], slug: string, locale: "en" | "th") {
  const match = vehicles.find((item) => item.slug === slug);
  if (!match) return slug;
  return locale === "th" ? match.nameTh : match.name;
}

function Choice({
  name,
  checked,
  title,
  detail,
  icon,
  onSelect,
}: {
  name: string;
  checked: boolean;
  title: string;
  detail: string;
  icon?: string;
  onSelect: () => void;
}) {
  return (
    <label className={`flex cursor-pointer gap-3 rounded-2xl border px-4 py-3 ${checked ? "border-brand bg-brand-soft" : "border-line bg-white"}`}>
      <input className="mt-1" type="radio" name={name} checked={checked} onChange={onSelect} />
      {icon ? <CategoryIcon name={icon} /> : null}
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="mt-1 block text-sm text-muted">{detail}</span>
      </span>
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

function CategoryIcon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    card: "M5 7.5h14v9H5z M8 11h5",
    globe: "M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M5 12h14 M12 5c2 2.2 2 11.8 0 14 M12 5c-2 2.2-2 11.8 0 14",
    refresh: "M7 8a5 5 0 0 1 8.5-1.5 M16 7v3h-3 M17 16a5 5 0 0 1-8.5 1.5 M8 17v-3h3",
    replace: "M8 7h8v4H8z M7 13h10v4H7z",
    permit: "M7 5h8l3 3v11H7z M15 5v3h3 M9 12h6 M9 15h4",
    more: "M6 12h.1 M12 12h.1 M18 12h.1",
  };
  return (
    <svg viewBox="0 0 24 24" className="mt-0.5 h-8 w-8 shrink-0 text-brand" aria-hidden>
      <path d={paths[name] ?? paths.more} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
