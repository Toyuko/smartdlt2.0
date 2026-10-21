import { route } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { isReference } from "@/lib/booking/codes";
import { hashRateLimitKey } from "@/lib/booking/tokens";
import { inspectDemoBooking } from "@/lib/data/store";
import { HttpError, json } from "@/lib/http";

export const POST = route(async (request) => {
  const staff = await requireStaff();
  const body = (await request.json().catch(() => null)) as { token?: unknown; reference?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const reference = typeof body?.reference === "string" ? body.reference.toUpperCase() : "";
  if (token) {
    if (token.length < 20 || token.length > 128) throw new HttpError(400, "invalid");
    return json(await inspectDemoBooking({ token, keyHash: hashRateLimitKey(staff.userId), bucket: "staff_verify" }));
  }
  if (!isReference(reference)) throw new HttpError(400, "reference_invalid");
  return json(
    await inspectDemoBooking({ reference, keyHash: hashRateLimitKey(staff.userId), bucket: "staff_verify" }),
  );
});
