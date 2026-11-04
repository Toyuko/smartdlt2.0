const THAI_ID_LENGTH = 13;

export function normalizeIdentityNumber(value: string) {
  const compact = value.trim().replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{13}$/.test(compact)) return isThaiNationalId(compact) ? compact : null;
  if (/^[A-Z0-9]{6,12}$/.test(compact) && /\d/.test(compact)) return compact;
  return null;
}

export function isThaiNationalId(value: string) {
  if (!/^\d{13}$/.test(value)) return false;
  let sum = 0;
  for (let index = 0; index < THAI_ID_LENGTH - 1; index += 1) {
    sum += Number(value[index]) * (THAI_ID_LENGTH - index);
  }
  const check = (11 - (sum % 11)) % 10;
  return check === Number(value[12]);
}

export function formatIdentityNumber(value: string | null | undefined) {
  const normalized = value ? normalizeIdentityNumber(value) : null;
  if (!normalized) return "";
  if (/^\d{13}$/.test(normalized)) {
    return `${normalized.slice(0, 1)}-${normalized.slice(1, 5)}-${normalized.slice(5, 10)}-${normalized.slice(10, 12)}-${normalized.slice(12)}`;
  }
  return normalized;
}
