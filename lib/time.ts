export const BANGKOK = "Asia/Bangkok";

export function bangkokDateParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BANGKOK,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const year = read("year");
  const month = read("month");
  const day = read("day");
  return {
    year: Number(year),
    month: Number(month),
    day: Number(day),
    hour: Number(read("hour")),
    minute: Number(read("minute")),
    isoDate: `${year}-${month}-${day}`,
    monthKey: `${year}-${month}`,
  };
}

export function monthRangeBangkok(monthKey: string) {
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    throw new Error("invalid_month");
  }
  const [yearText, monthText] = monthKey.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const start = new Date(`${monthKey}-01T00:00:00+07:00`);
  const nextMonth = month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
  const end = new Date(`${nextMonth}-01T00:00:00+07:00`);
  return { start, end };
}

export function formatLongDate(iso: string, locale: "en" | "th") {
  const date = new Date(iso);
  if (locale === "th") {
    return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
      timeZone: BANGKOK,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(date);
  }
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGKOK,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatTime(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: BANGKOK,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function formatBookingDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const parts = bangkokDateParts(date);
  return `${String(parts.day).padStart(2, "0")}/${String(parts.month).padStart(2, "0")}/${parts.year}`;
}

export function formatSlotRange(startsAt: string, endsAt: string) {
  const start = clock12(startsAt);
  const end = clock12(endsAt);
  if (!start || !end) return "—";
  if (start.suffix === end.suffix) return `${start.hm}–${end.hm} ${start.suffix}`;
  return `${start.hm} ${start.suffix}–${end.hm} ${end.suffix}`;
}

export function formatSlipRound(startsAt: string, endsAt: string) {
  return formatSlotRange(startsAt, endsAt).replaceAll("–", " - ");
}

export function formatAppointmentDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
    timeZone: BANGKOK,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatAppointmentRange(startsAt: string, endsAt: string) {
  if (Number.isNaN(new Date(startsAt).getTime()) || Number.isNaN(new Date(endsAt).getTime())) return "—";
  return `${formatTime(startsAt)} - ${formatTime(endsAt)} น.`;
}

function clock12(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const parts = bangkokDateParts(date);
  const suffix = parts.hour >= 12 ? "PM" : "AM";
  const hour12 = parts.hour % 12 === 0 ? 12 : parts.hour % 12;
  return { hm: `${String(hour12).padStart(2, "0")}:${String(parts.minute).padStart(2, "0")}`, suffix };
}

export function shiftIsoDate(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T12:00:00+07:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return bangkokDateParts(date).isoDate;
}

export function weekdayBangkok(isoDate: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: BANGKOK, weekday: "short" }).format(
    new Date(`${isoDate}T12:00:00+07:00`),
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function monthGrid(monthKey: string) {
  const first = `${monthKey}-01`;
  const leading = WEEKDAYS.indexOf(weekdayBangkok(first));
  const [year, month] = monthKey.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: Array<{ isoDate: string; day: number } | null> = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ isoDate: `${monthKey}-${String(day).padStart(2, "0")}`, day });
  }
  return cells;
}
