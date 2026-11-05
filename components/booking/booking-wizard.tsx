"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { MonthCalendar, type DayState } from "@/components/booking/month-calendar";
import { DocumentGuidance } from "@/components/booking/document-guidance";
import { RenewalLicenceForm } from "@/components/booking/renewal-licence-form";
import { errorText, SetupRequired, useI18n } from "@/components/language";
import { Button, Field, inputClass, queueFieldClass, queueInputClass } from "@/components/ui";
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
import { formatIdentityNumber } from "@/lib/booking/identity";
import { bookingRequestSchema, type BookingRequest } from "@/lib/booking/validation";
import { renewalReviewEntries, renewalVehicles } from "@/lib/booking/renewal-form";
import type { Dictionary } from "@/lib/i18n/dictionary";
import { serviceChoiceDetail } from "@/lib/demo-catalog";
import { DEMO_NOTICE } from "@/lib/demo-notice";
import { bangkokDateParts, formatVisitRange, shiftIsoDate } from "@/lib/time";
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
  identityNumber: "",
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
  const renewalForm = renewalVehicles(service?.slug ?? "").length > 0;
  const steps = buildWizardSteps({ requiresVehicle: Boolean(service?.requiresVehicle), hasQuestions: questions });
  const step = steps.includes(stepId) ? stepId : "applicant";
  const stepIndex = Math.max(0, steps.indexOf(step));
  const today = todayBangkok();
  const horizonDays = category?.slotRules.horizonDays ?? 21;
  const maxMonth = shiftIsoDate(today, horizonDays).slice(0, 7);
  const renewal = category ? evaluateRenewal(category, values.answers, today) : { state: "not_applicable" as const };
  const renewalBlocked = renewal.state === "invalid_date" || renewal.state === "missing";

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
    replaceAnswers(next);
  }

  function replaceAnswers(next: Record<string, string>) {
    form.setValue("answers", next);
    setAnswerErrors({});
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
      <QueueFrame>
        <div className="mx-auto w-full max-w-xl px-5 py-10">
          <p data-testid="demo-banner" className="text-sm font-semibold text-[#6d28d9]">
            {DEMO_NOTICE}
          </p>
          <h1 className="mt-4 text-2xl font-bold">{t.book.title}</h1>
          <SetupRequired />
        </div>
      </QueueFrame>
    );
  }
  if (!catalog && !loadError) {
    return (
      <QueueFrame>
        <div className="mx-auto w-full max-w-xl px-5 py-10">
          <h1 className="text-2xl font-bold text-[#6d28d9]">{t.book.title}</h1>
          <p className="mt-2 text-sm text-muted">{t.book.loading}</p>
        </div>
      </QueueFrame>
    );
  }
  if (loadError || !catalog) {
    return (
      <QueueFrame>
        <p role="alert" className="px-5 py-10">
          {errorText(t.errors, loadError)}
        </p>
      </QueueFrame>
    );
  }

  const eligibleCategories = office ? categories.filter((item) => item.eligibleOfficeSlugs.includes(office.slug)) : categories;

  const narrow = step === "questions" || step === "applicant" || step === "applicantCategory";
  const contentWidth = step === "schedule" ? "max-w-4xl" : narrow ? "max-w-xl" : "max-w-2xl";

  return (
    <QueueFrame
      sidebar={
        <>
          <p className="mb-3 text-sm font-semibold text-[#241b33] lg:hidden" data-testid="wizard-compact-progress">
            {stepIndex + 1} / {steps.length} · {stepLabel(step, renewalForm, t)}
          </p>
          <ol className="flex flex-col" aria-label="Progress" data-testid="wizard-steps">
            {steps.map((item, index) => {
              const complete = index < stepIndex;
              const current = item === step;
              const title = stepLabel(item, renewalForm, t);
              return (
                <li key={item}>
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 py-2.5 text-left disabled:cursor-default disabled:opacity-100"
                    onClick={() => {
                      if (index < stepIndex) setStepId(item);
                    }}
                    disabled={index > stepIndex}
                    aria-current={current ? "step" : undefined}
                    aria-label={complete ? `✓${title}` : undefined}
                  >
                    <span
                      className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${complete ? "bg-[#22a85a] text-white" : current ? "bg-[#4c1d95] text-white" : "bg-[#e5e7eb] text-[#9aa0ab]"}`}
                    >
                      {complete ? <StepCheck /> : index + 1}
                    </span>
                    <span>
                      <span className="block text-sm font-bold leading-5 text-[#241b33]">{title}</span>
                      <span className="mt-0.5 block text-xs leading-4 text-[#8b909a]" aria-hidden="true">
                        {t.book.stepHints[item]}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="mt-8 border-t border-[#e5e7eb] pt-4 text-xs leading-5 text-[#5c5470]" data-testid="wizard-disclaimer">
            {DEMO_NOTICE}
          </p>
        </>
      }
    >
      <div className={`mx-auto w-full px-5 py-8 sm:px-8 sm:py-10 ${contentWidth}`}>
        <div className="mb-8 flex flex-col items-center text-center">
          <QueueMark />
          <h1 className="mt-4 text-[22px] font-semibold text-[#6d28d9]">{step === "questions" ? t.book.renewalComplete : step === "applicantCategory" ? t.book.title : stepLabel(step, renewalForm, t)}</h1>
          {step === "questions" ? null : <p className="mt-2 max-w-lg text-sm leading-6 text-[#6b7280]">{helpFor(step, t)}</p>}
        </div>
        <div className="space-y-4" data-testid={`wizard-panel-${step}`}>
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
                  detail={serviceChoiceDetail(
                    item.slug,
                    locale,
                    item.requiresVehicle ? t.book.vehicleHelp : t.book.serviceHelp,
                  )}
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
          {step === "questions" && renewalForm ? (
            <RenewalLicenceForm serviceSlug={service?.slug ?? ""} answers={values.answers} errors={answerErrors} onChange={replaceAnswers} />
          ) : null}
          {step === "questions" && !renewalForm ? (
            <div className="queue-fields grid gap-5">
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
                        className={queueFieldClass}
                        type="date"
                        value={value}
                        onChange={(event) => setAnswer(field.key, event.target.value)}
                      />
                    ) : (
                      <select className={queueInputClass} value={value} onChange={(event) => setAnswer(field.key, event.target.value)}>
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
            </div>
          ) : null}
          {step === "applicant" ? (
            <div className="grid gap-4">
              <Field label={t.book.name} error={errorText(t.errors, form.formState.errors.applicantDisplayName?.message)}>
                <input className={inputClass} {...form.register("applicantDisplayName")} autoComplete="name" />
              </Field>
              <Field label={t.book.identityNumber} hint={t.book.identityHint} error={errorText(t.errors, form.formState.errors.identityNumber?.message)}>
                <input className={inputClass} {...form.register("identityNumber")} autoComplete="off" spellCheck={false} />
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
                          {formatVisitRange(item.starts_at, item.ends_at)} · {closed ? t.book.full : `${item.remaining} ${t.book.seats}`}
                        </button>
                      );
                    })}
                  </div>
                  {slot ? (
                    <p className="mt-4 text-sm font-semibold" data-testid="selected-slot">
                      {t.book.selectedSlot}: {bangkokDateParts(new Date(slot.starts_at)).isoDate} {formatVisitRange(slot.starts_at, slot.ends_at)}
                    </p>
                  ) : null}
                  {form.formState.errors.timeSlotId ? <p role="alert" className="mt-2 text-sm text-full">{errorText(t.errors, form.formState.errors.timeSlotId.message)}</p> : null}
                </div>
              </div>
          ) : null}
          {step === "review" ? (
            <div className="space-y-3 text-sm leading-6">
              <Review label={t.book.name} value={values.applicantDisplayName} />
              <Review label={t.confirm.idNo} value={formatIdentityNumber(values.identityNumber) || values.identityNumber} />
              <Review label={t.confirm.applicantCategory} value={values.applicantCategory === "foreign" ? t.book.applicantForeign : t.book.applicantThai} />
              <Review label={t.staff.office} value={office ? `${locale === "th" ? office.nameTh : office.name} — ${office.demoLabel}` : ""} />
              <Review label={t.confirm.category} value={category ? (locale === "th" ? category.nameTh : category.name) : ""} />
              <Review label={t.staff.service} value={service ? (locale === "th" ? service.nameTh : service.name) : ""} />
              {values.vehicleCategory ? <Review label={t.confirm.vehicle} value={vehicleLabel(vehicleChoices, values.vehicleCategory, locale)} /> : null}
              {(renewalReviewEntries(values.answers, locale) ??
                Object.entries(values.answers).map(([key, value]) => answerLabel(category, key, value, locale))
              ).map((labelled) => (
                <Review key={`${labelled.label}-${labelled.value}`} label={labelled.label} value={labelled.value} />
              ))}
              <Review label={t.staff.date} value={slot ? `${bangkokDateParts(new Date(slot.starts_at)).isoDate} ${formatVisitRange(slot.starts_at, slot.ends_at)}` : ""} />
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
        <div className="mt-8 flex flex-wrap justify-between gap-3">
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
                (step === "service" && visibleServices.length === 0)
              }
            >
              {t.actions.continue}
            </Button>
          )}
        </div>
      </div>
    </QueueFrame>
  );
}

function stepLabel(step: WizardStepId, renewalForm: boolean, t: Dictionary) {
  if (step === "questions" && renewalForm) return t.book.drivingLicense;
  return t.book.steps[step];
}

function QueueFrame({ sidebar, children }: { sidebar?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-white text-[#241b33]">
      <QueueHeader />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {sidebar ? <aside className="no-print shrink-0 bg-[#f3f4f6] px-4 py-4 lg:w-[300px] lg:px-6 lg:py-8">{sidebar}</aside> : null}
        <main className="queue-scroll min-h-0 flex-1 overflow-y-auto bg-white">{children}</main>
      </div>
    </div>
  );
}

function QueueHeader() {
  const { t, locale, setLocale } = useI18n();
  const links = [
    { href: "/", label: t.book.queueHome, current: true },
    { href: "/lookup", label: t.book.queueProfile, current: false },
    { href: "/about-demo", label: t.book.queueHistory, current: false },
    { href: "/staff/login", label: t.book.queueLogout, current: false },
  ];
  return (
    <header className="no-print flex flex-wrap items-center justify-between gap-y-1 bg-[#4c1d95] px-3 text-white sm:h-16 sm:flex-nowrap sm:px-6">
      <div className="flex items-center gap-3 py-2">
        <QueueMark compact />
        <span className="hidden text-white/70 sm:inline" aria-hidden>
          |
        </span>
        <span className="hidden text-sm font-medium sm:inline">{t.book.queueOrg}</span>
      </div>
      <nav className="flex items-stretch" aria-label="Primary">
        {links.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className={`flex items-center px-2.5 text-sm font-medium text-white sm:px-3 ${link.current ? "border-b-4 border-[#e9d5ff]" : ""}`}
          >
            {link.label}
          </Link>
        ))}
        <div className="ml-1 flex items-center gap-1 px-1" role="group" aria-label="Language">
          <button
            type="button"
            className={`rounded-full px-2 py-1 text-sm font-semibold ${locale === "en" ? "bg-white/20" : "text-white/75"}`}
            aria-pressed={locale === "en"}
            onClick={() => setLocale("en")}
          >
            EN
          </button>
          <button
            type="button"
            className={`rounded-full px-2 py-1 text-sm font-semibold ${locale === "th" ? "bg-white/20" : "text-white/75"}`}
            aria-pressed={locale === "th"}
            onClick={() => setLocale("th")}
          >
            ไทย
          </button>
        </div>
      </nav>
    </header>
  );
}

function QueueMark({ compact = false }: { compact?: boolean }) {
  const id = compact ? "queue-mark-sm" : "queue-mark-lg";
  return (
    <div className={`flex items-center ${compact ? "gap-1.5" : "flex-col"}`}>
      <svg viewBox="0 0 64 64" className={compact ? "h-9 w-9" : "h-16 w-16"} aria-hidden>
        <defs>
          <linearGradient id={id} x1="8" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ff4b8b" />
            <stop offset="0.45" stopColor="#ff8a3d" />
            <stop offset="1" stopColor="#7c3aed" />
          </linearGradient>
        </defs>
        <rect x="10" y="10" width="44" height="44" rx="14" fill={`url(#${id})`} transform="rotate(8 32 32)" />
        <text x="32" y="41" textAnchor="middle" fontSize="26" fontWeight="700" fill="white" fontFamily="Arial, sans-serif">
          Q
        </text>
      </svg>
      <span className={compact ? "leading-none text-white" : "mt-1 text-center leading-none"}>
        <span className={`block font-extrabold tracking-wide ${compact ? "text-[11px]" : "text-lg"}`}>
          <span className={compact ? "text-white" : "text-[#7c3aed]"}>D</span>
          <span className={compact ? "text-white" : "text-[#ff4b8b]"}>L</span>
          <span className={compact ? "text-white" : "text-[#ff8a3d]"}>T</span>
        </span>
        <span className={`block font-bold tracking-[0.18em] ${compact ? "text-[7px] text-white/80" : "text-[10px] text-[#7c3aed]"}`}>SMART QUEUE</span>
      </span>
    </div>
  );
}

function StepCheck() {
  return (
    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" aria-hidden>
      <path d="M3.5 8.2 6.4 11l6.1-6.2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function fieldsFor(step: WizardStepId): (keyof BookingRequest)[] {
  if (step === "applicantCategory") return ["applicantCategory"];
  if (step === "office") return ["officeId"];
  if (step === "service") return ["serviceId"];
  if (step === "applicant") return ["applicantDisplayName", "identityNumber", "contactEmail", "contactPhone", "notes"];
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
