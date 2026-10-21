import { route } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { transitionSchema } from "@/lib/booking/validation";
import { staffTransition } from "@/lib/data/store";
import { HttpError, json } from "@/lib/http";

export const POST = route(async (request, context) => {
  const staff = await requireStaff();
  const { id } = await context.params;
  const parsed = transitionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) throw new HttpError(400, "invalid_transition");
  const result = await staffTransition(id, staff.userId, parsed.data.action);
  if (!result) throw new HttpError(404, "not_found");
  return json(result);
});
