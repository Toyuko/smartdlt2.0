import "server-only";
import { cache } from "react";
import { isDatabaseConfigured } from "@/lib/env";
import { HttpError, SetupError } from "@/lib/http";
import { createAdminClient, createSessionClient } from "@/lib/supabase/clients";

export type StaffSession =
  | { kind: "setup" }
  | { kind: "anonymous" }
  | { kind: "forbidden" }
  | { kind: "staff"; userId: string; email: string; displayName: string; role: "staff" | "admin" };

export const getStaffSession = cache(async (): Promise<StaffSession> => {
  if (!isDatabaseConfigured()) return { kind: "setup" };
  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return { kind: "anonymous" };

  const admin = createAdminClient();
  const profile = await admin
    .from("staff_profiles")
    .select("display_name, role")
    .eq("user_id", data.user.id)
    .maybeSingle();
  if (profile.error || !profile.data) return { kind: "forbidden" };
  if (profile.data.role !== "staff" && profile.data.role !== "admin") return { kind: "forbidden" };

  return {
    kind: "staff",
    userId: data.user.id,
    email: data.user.email ?? "",
    displayName: profile.data.display_name,
    role: profile.data.role,
  };
});

export async function requireStaff() {
  const session = await getStaffSession();
  if (session.kind === "setup") throw new SetupError();
  if (session.kind === "anonymous") throw new HttpError(401, "unauthenticated", "Sign in as demonstration staff.");
  if (session.kind === "forbidden") throw new HttpError(403, "forbidden", "This account is not a demonstration staff account.");
  return session;
}
