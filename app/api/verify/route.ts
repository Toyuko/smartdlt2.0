import { rateKey, route } from "@/lib/api";
import { inspectDemoBooking } from "@/lib/data/store";
import { HttpError, json } from "@/lib/http";

export const POST = route(async (request) => {
  const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  if (token.length < 20 || token.length > 128) throw new HttpError(400, "invalid");
  const result = await inspectDemoBooking({ token, keyHash: rateKey(request), bucket: "verify_token" });
  return json(result, result.outcome === "invalid" ? 404 : 200);
});
