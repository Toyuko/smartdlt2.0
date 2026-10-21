import { route } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { staffGetBooking } from "@/lib/data/store";
import { HttpError, json } from "@/lib/http";

export const GET = route(async (_request, context) => {
  await requireStaff();
  const { id } = await context.params;
  const result = await staffGetBooking(id);
  if (!result) throw new HttpError(404, "not_found");
  return json(result);
});
