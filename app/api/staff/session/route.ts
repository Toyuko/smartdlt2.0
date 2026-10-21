import { route } from "@/lib/api";
import { requireStaff } from "@/lib/auth";
import { json } from "@/lib/http";

export const GET = route(async () => {
  const staff = await requireStaff();
  return json({ displayName: staff.displayName, role: staff.role });
});
