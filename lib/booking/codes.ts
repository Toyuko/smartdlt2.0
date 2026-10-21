const REFERENCE_PATTERN = /^VD-[A-Z2-9]{4}-[A-Z2-9]{4}$/;

export function isReference(value: string) {
  return REFERENCE_PATTERN.test(value);
}

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,128}$/;

export function isTicketToken(value: string) {
  return TOKEN_PATTERN.test(value);
}

export function buildVerificationUrl(origin: string, token: string) {
  const base = origin.endsWith("/") ? origin : `${origin}/`;
  const url = new URL(`demo-ticket/${encodeURIComponent(token)}`, base);
  url.search = "";
  url.hash = "";
  return url.toString();
}

export function resolveTicketOrigin(headerList: { get(name: string): string | null }) {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const proto = headerList.get("x-forwarded-proto") ?? "https";
  const host = headerList.get("x-forwarded-host") ?? headerList.get("host");
  if (!host) return "";
  return `${proto}://${host}`;
}

export function parseScanPayload(raw: string, allowedOrigins: string[]) {
  const value = raw.trim();
  const reference = value.toUpperCase();
  if (isReference(reference)) {
    return { type: "reference" as const, reference };
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { type: "rejected" as const };
  }
  const origins = new Set(
    allowedOrigins
      .map((origin) => {
        try {
          return new URL(origin).origin;
        } catch {
          return null;
        }
      })
      .filter((origin): origin is string => Boolean(origin)),
  );
  if (!origins.has(url.origin) || url.search || url.hash) {
    return { type: "rejected" as const };
  }
  const match = url.pathname.match(/^\/(?:demo-ticket|v)\/([^/]+)$/);
  if (!match?.[1]) return { type: "rejected" as const };
  const token = decodeURIComponent(match[1]);
  if (token.length < 20 || token.length > 128) return { type: "rejected" as const };
  return { type: "token" as const, token };
}
