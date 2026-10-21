import { rateKey, route } from "@/lib/api";
import { lookupSchema } from "@/lib/booking/validation";
import { inspectDemoBooking } from "@/lib/data/store";
import { HttpError, json } from "@/lib/http";

export const GET = route(async (request, context) => {
  const { reference } = await context.params;
  const parsed = lookupSchema.safeParse({ reference });
  if (!parsed.success) throw new HttpError(400, "reference_invalid");
  const result = await inspectDemoBooking({
    reference: parsed.data.reference,
    keyHash: rateKey(request),
    bucket: "booking_lookup",
  });
  if (!result.booking) throw new HttpError(404, "not_found");
  return json({ booking: result.booking, outcome: result.outcome });
});
