import { rateKey, route } from "@/lib/api";
import { lookupSchema } from "@/lib/booking/validation";
import { inspectDemoBooking } from "@/lib/data/store";
import { HttpError, json } from "@/lib/http";

export const POST = route(async (request) => {
  const body = await request.json().catch(() => null);
  const parsed = lookupSchema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, "reference_invalid");
  const result = await inspectDemoBooking({
    reference: parsed.data.reference,
    keyHash: rateKey(request),
    bucket: "booking_lookup",
  });
  return json(result, result.booking ? 200 : 404);
});
