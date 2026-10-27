import { route } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { createDemoBooking } from "@/lib/booking/create-booking";
import { hashRateLimitKey } from "@/lib/booking/tokens";
import { staffFilterSchema } from "@/lib/booking/validation";
import { createSupabaseBookingWriter, staffListBookings } from "@/lib/data/store";
import { HttpError, json, requestOrigin } from "@/lib/http";

export const GET = route(async (request) => {
  await requireStaff();
  const url = new URL(request.url);
  const parsed = staffFilterSchema.safeParse({
    reference: url.searchParams.get("reference") ?? "",
    officeId: url.searchParams.get("officeId") ?? "",
    serviceId: url.searchParams.get("serviceId") ?? "",
    status: url.searchParams.get("status") ?? "",
    date: url.searchParams.get("date") ?? "",
  });
  if (!parsed.success) throw new HttpError(400, "validation");
  const filters = parsed.data;
  return json({
    bookings: await staffListBookings({
      reference: filters.reference || undefined,
      officeId: filters.officeId || undefined,
      serviceId: filters.serviceId || undefined,
      status: filters.status || undefined,
      date: filters.date || undefined,
    }),
  });
});

export const POST = route(async (request) => {
  const session = await requireStaff();
  const body = await request.json().catch(() => null);
  const result = await createDemoBooking(createSupabaseBookingWriter(), body, {
    keyHash: hashRateLimitKey(`staff:${session.userId}`),
    origin: requestOrigin(request),
    rateLimit: { bucket: "staff_quick_signup", limit: 120, windowSeconds: 60 * 60 },
  });
  return json(result, 201);
});
