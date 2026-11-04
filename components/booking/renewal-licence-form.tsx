"use client";

import { errorText, useI18n } from "@/components/language";
import { queueInputClass } from "@/components/ui";
import type { RenewalVehicle } from "@/lib/booking/renewal-form";
import { normalizeRenewalAnswers, renewalVehicles } from "@/lib/booking/renewal-form";

const MONTHS = [
  ["01", "January", "มกราคม"],
  ["02", "February", "กุมภาพันธ์"],
  ["03", "March", "มีนาคม"],
  ["04", "April", "เมษายน"],
  ["05", "May", "พฤษภาคม"],
  ["06", "June", "มิถุนายน"],
  ["07", "July", "กรกฎาคม"],
  ["08", "August", "สิงหาคม"],
  ["09", "September", "กันยายน"],
  ["10", "October", "ตุลาคม"],
  ["11", "November", "พฤศจิกายน"],
  ["12", "December", "ธันวาคม"],
] as const;

const YEARS = ["2024", "2025", "2026", "2027", "2028", "2029"];

export function RenewalLicenceForm({
  serviceSlug,
  answers,
  errors,
  onChange,
}: {
  serviceSlug: string;
  answers: Record<string, string>;
  errors: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
}) {
  const { locale, t } = useI18n();
  const vehicles = renewalVehicles(serviceSlug);
  const many = vehicles.length > 1;

  function write(vehicle: RenewalVehicle, part: "Day" | "Month" | "Year" | "Lost", value: string) {
    const next = { ...answers, [`${vehicle}${part}`]: value };
    if (!value) delete next[`${vehicle}${part}`];
    onChange(normalizeRenewalAnswers(serviceSlug, next));
  }

  return (
    <div className="space-y-9">
      {vehicles.map((vehicle) => {
        const vehicleName = vehicle === "car" ? t.book.vehicleCar : t.book.vehicleMotorcycle;
        const suffix = many ? `, ${vehicleName}` : "";
        const error = errorText(t.errors, errors[`${vehicle}Day`]);
        return (
          <fieldset key={vehicle} className="space-y-4">
            <legend className="text-base font-bold text-[#6d28d9]">{t.book.renewalExpiry}</legend>
            <div className="grid grid-cols-3 gap-3">
              <select
                aria-label={`${t.book.day}${suffix}`}
                className={queueInputClass}
                value={answers[`${vehicle}Day`] ?? ""}
                onChange={(event) => write(vehicle, "Day", event.target.value)}
              >
                <option value="">{t.book.day}</option>
                {Array.from({ length: 31 }, (_, index) => String(index + 1).padStart(2, "0")).map((day) => (
                  <option key={day} value={day}>
                    {Number(day)}
                  </option>
                ))}
              </select>
              <select
                aria-label={`${t.book.month}${suffix}`}
                className={queueInputClass}
                value={answers[`${vehicle}Month`] ?? ""}
                onChange={(event) => write(vehicle, "Month", event.target.value)}
              >
                <option value="">{t.book.month}</option>
                {MONTHS.map(([value, en, th]) => (
                  <option key={value} value={value}>
                    {locale === "th" ? th : en}
                  </option>
                ))}
              </select>
              <select
                aria-label={`${t.book.year}${suffix}`}
                className={queueInputClass}
                value={answers[`${vehicle}Year`] ?? ""}
                onChange={(event) => write(vehicle, "Year", event.target.value)}
              >
                <option value="">{t.book.year}</option>
                {YEARS.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            {error ? (
              <p role="alert" className="text-sm font-semibold text-full">
                {error}
              </p>
            ) : null}
            <p className="text-base font-bold text-[#6d28d9]">{t.book.renewalVehicle}</p>
            <select aria-label={`${t.book.renewalVehicle}${suffix}`} className={queueInputClass} value={vehicle} onChange={() => undefined}>
              <option value={vehicle}>{vehicleName}</option>
            </select>
            <label className="flex items-center gap-3 text-base font-bold text-[#6d28d9]">
              <input
                type="checkbox"
                className="h-5 w-5 accent-brand"
                checked={answers[`${vehicle}Lost`] === "yes"}
                onChange={(event) => write(vehicle, "Lost", event.target.checked ? "yes" : "no")}
              />
              {t.book.renewalLost}
            </label>
          </fieldset>
        );
      })}
    </div>
  );
}
