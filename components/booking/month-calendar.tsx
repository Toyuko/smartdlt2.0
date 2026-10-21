"use client";

import { monthGrid } from "@/lib/time";
import { useI18n } from "@/components/language";

export type DayState = "available" | "full" | "unavailable" | "past";

const weekdayEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const weekdayTh = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];

export function MonthCalendar({
  monthKey,
  today,
  selectedDate,
  days,
  onSelect,
  onMonth,
  canPrev,
  canNext,
}: {
  monthKey: string;
  today: string;
  selectedDate: string;
  days: Record<string, DayState>;
  onSelect: (isoDate: string) => void;
  onMonth: (delta: number) => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  const { locale, t } = useI18n();
  const cells = monthGrid(monthKey);
  const labels = locale === "th" ? weekdayTh : weekdayEn;
  const [year, month] = monthKey.split("-").map(Number);
  const title = new Intl.DateTimeFormat(locale === "th" ? "th-TH-u-ca-buddhist" : "en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">{title}</h3>
        <div className="flex gap-2">
          <button type="button" className="rounded-full border border-line px-3 py-2 text-sm font-semibold disabled:opacity-40" onClick={() => onMonth(-1)} disabled={!canPrev}>
            <span aria-hidden>‹</span> <span className="sr-only">{t.calendar.previous}</span>
          </button>
          <button type="button" className="rounded-full border border-line px-3 py-2 text-sm font-semibold disabled:opacity-40" onClick={() => onMonth(1)} disabled={!canNext}>
            <span aria-hidden>›</span> <span className="sr-only">{t.calendar.next}</span>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-muted">
        {labels.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((cell, index) => {
          if (!cell) return <div key={`empty-${index}`} />;
          const state = cell.isoDate < today ? "past" : (days[cell.isoDate] ?? "unavailable");
          const disabled = state !== "available";
          const selected = cell.isoDate === selectedDate;
          return (
            <button
              key={cell.isoDate}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`${cell.isoDate} ${t.calendar[state]}`}
              onClick={() => onSelect(cell.isoDate)}
              className={`min-h-11 rounded-2xl text-sm font-semibold ${
                selected
                  ? "bg-brand text-white"
                  : state === "available"
                    ? "bg-good/10 text-good"
                    : state === "full"
                      ? "bg-full/10 text-full"
                      : "bg-paper text-muted"
              } disabled:cursor-not-allowed`}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
      <ul className="mt-4 flex flex-wrap gap-3 text-xs text-muted">
        <li className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-good" />{t.calendar.available}</li>
        <li className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-full" />{t.calendar.full}</li>
        <li className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-ink" />{t.calendar.unavailable}</li>
        <li className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-line" />{t.calendar.past}</li>
      </ul>
    </div>
  );
}
