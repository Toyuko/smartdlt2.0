import { route } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { staffFilterSchema } from "@/lib/booking/validation";
import { staffListBookings } from "@/lib/data/store";
import { HttpError, json } from "@/lib/http";

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
