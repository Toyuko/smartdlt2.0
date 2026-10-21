import { route } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { staffSummary } from "@/lib/data/store";
import { json } from "@/lib/http";

export const GET = route(async () => {
  const staff = await requireStaff();
  return json({ counts: await staffSummary(staff.userId) });
});
