import { rateKey, route } from "@/lib/api";
import { createDemoBooking } from "@/lib/booking/create-booking";
import { createSupabaseBookingWriter } from "@/lib/data/store";
import { json, requestOrigin } from "@/lib/http";

export const POST = route(async (request) => {
  const body = await request.json().catch(() => null);
  const result = await createDemoBooking(createSupabaseBookingWriter(), body, {
    keyHash: rateKey(request),
    origin: requestOrigin(request),
  });
  return json(result, 201);
});
