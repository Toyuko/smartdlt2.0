export class HttpError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;

  constructor(status: number, code: string, message?: string, fieldErrors?: Record<string, string>) {
    super(message ?? code);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export class SetupError extends Error {
  constructor() {
    super(
      "Supabase environment variables are missing. Copy .env.example to .env.local and configure the demo database. This application does not store bookings in memory.",
    );
    this.name = "SetupError";
  }
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function jsonError(error: unknown) {
  if (error instanceof SetupError) {
    return json({ error: "setup_required", message: error.message }, 503);
  }
  if (error instanceof HttpError) {
    return json({ error: error.code, message: error.message, fieldErrors: error.fieldErrors }, error.status);
  }
  console.error("Unhandled demo API error");
  return json({ error: "server_error", message: "Something went wrong." }, 500);
}

const DB_STATUS: Record<string, number> = {
  slot_full: 409,
  slot_past: 409,
  slot_unavailable: 409,
  idempotency_conflict: 409,
  reference_conflict: 409,
  already_checked_in: 409,
  invalid_transition: 409,
  vehicle_required: 400,
  renewal_window: 409,
  validation: 400,
  unauthorized: 403,
  not_found: 404,
};

export function readDbCode(error: { message?: string; details?: string } | null) {
  const text = `${error?.message ?? ""} ${error?.details ?? ""}`;
  return text.match(/demo_booking:([a-z0-9_]+)/)?.[1] ?? null;
}

export function httpErrorFromDb(error: { message?: string; details?: string } | null) {
  const code = readDbCode(error);
  if (!code) return new HttpError(500, "server_error");
  return new HttpError(DB_STATUS[code] ?? 400, code);
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function requestOrigin(request: Request) {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) return configured.replace(/\/$/, "");
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}
