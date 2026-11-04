export type RenewalVehicle = "motorcycle" | "car";

const VEHICLES: RenewalVehicle[] = ["motorcycle", "car"];

export function renewalVehicles(serviceSlug: string): RenewalVehicle[] {
  if (serviceSlug === "renewal-car-motorcycle") return ["motorcycle", "car"];
  if (serviceSlug === "renewal-motorcycle") return ["motorcycle"];
  if (serviceSlug === "renewal-car") return ["car"];
  return [];
}

export function renewalStoredKeys(serviceSlug: string) {
  return renewalVehicles(serviceSlug).flatMap((vehicle) => [
    `${vehicle}Day`,
    `${vehicle}Month`,
    `${vehicle}Year`,
    `${vehicle}Lost`,
    `${vehicle}ExpiryDate`,
  ]);
}

export function hasRenewalCardParts(answers: Record<string, string>) {
  return Object.keys(answers).some((key) => /^(motorcycle|car)(Day|Month|Year|Lost|ExpiryDate)$/.test(key));
}

export function usesRenewalCards(serviceSlug: string, answers: Record<string, string>) {
  const vehicles = renewalVehicles(serviceSlug);
  if (!vehicles.length) return false;
  if (hasRenewalCardParts(answers)) return true;
  return !answers.expiryDate && !answers.currentLicenceType;
}

function isRealDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function composeRenewalDate(day: string, month: string, year: string) {
  if (!day || !month || !year) return "";
  const iso = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  return isRealDate(iso) ? iso : "";
}

export function normalizeRenewalAnswers(serviceSlug: string, answers: Record<string, string>) {
  const vehicles = renewalVehicles(serviceSlug);
  if (!vehicles.length || !hasRenewalCardParts(answers)) return { ...answers };
  const next = { ...answers };
  let primary = "";
  for (const vehicle of vehicles) {
    const day = next[`${vehicle}Day`] ?? "";
    const month = next[`${vehicle}Month`] ?? "";
    const year = next[`${vehicle}Year`] ?? "";
    const iso = composeRenewalDate(day, month, year);
    if (iso) {
      next[`${vehicle}ExpiryDate`] = iso;
      if (!primary) primary = iso;
    } else {
      delete next[`${vehicle}ExpiryDate`];
    }
    if (next[`${vehicle}Lost`] !== "yes") next[`${vehicle}Lost`] = "no";
  }
  if (primary) next.expiryDate = primary;
  else delete next.expiryDate;
  if (!next.currentLicenceType) next.currentLicenceType = "five_year";
  return next;
}

export function renewalCardDates(answers: Record<string, string>) {
  return VEHICLES.flatMap((vehicle) => {
    const started = Boolean(answers[`${vehicle}Day`] || answers[`${vehicle}Month`] || answers[`${vehicle}Year`] || answers[`${vehicle}ExpiryDate`]);
    if (!started) return [];
    return [{ vehicle, iso: answers[`${vehicle}ExpiryDate`] ?? "" }];
  });
}

const REVIEW_LABELS: Record<string, { en: string; th: string }> = {
  motorcycleExpiryDate: { en: "Driving license expiration date — motorcycle", th: "วันหมดอายุใบอนุญาต — รถจักรยานยนต์" },
  carExpiryDate: { en: "Driving license expiration date — car", th: "วันหมดอายุใบอนุญาต — รถยนต์" },
  motorcycleLost: { en: "Lost driving license — motorcycle", th: "ใบอนุญาตสูญหาย — รถจักรยานยนต์" },
  carLost: { en: "Lost driving license — car", th: "ใบอนุญาตสูญหาย — รถยนต์" },
};

export function renewalReviewEntries(answers: Record<string, string>, locale: "en" | "th") {
  if (!hasRenewalCardParts(answers)) return null;
  const yes = locale === "th" ? "ใช่" : "Yes";
  const no = locale === "th" ? "ไม่ใช่" : "No";
  return VEHICLES.flatMap((vehicle) => {
    const entries: Array<{ key: string; label: string; value: string }> = [];
    const date = answers[`${vehicle}ExpiryDate`];
    if (date) {
      const label = REVIEW_LABELS[`${vehicle}ExpiryDate`];
      entries.push({ key: `${vehicle}ExpiryDate`, label: locale === "th" ? label.th : label.en, value: date });
    }
    const lost = answers[`${vehicle}Lost`];
    if (lost === "yes" || lost === "no") {
      const label = REVIEW_LABELS[`${vehicle}Lost`];
      entries.push({ key: `${vehicle}Lost`, label: locale === "th" ? label.th : label.en, value: lost === "yes" ? yes : no });
    }
    return entries;
  });
}
