import { connection } from "next/server";
import { route } from "@/lib/api";
import { availabilityQuerySchema } from "@/lib/booking/validation";
import { getAvailability } from "@/lib/data/store";
import { HttpError, json } from "@/lib/http";

export const GET = route(async (request) => {
  await connection();
  const url = new URL(request.url);
  const parsed = availabilityQuerySchema.safeParse({
    officeId: url.searchParams.get("officeId"),
    serviceId: url.searchParams.get("serviceId"),
    month: url.searchParams.get("month"),
  });
  if (!parsed.success) throw new HttpError(400, "validation");
  const slots = await getAvailability(parsed.data.officeId, parsed.data.serviceId, parsed.data.month);
  return json({ slots });
});
