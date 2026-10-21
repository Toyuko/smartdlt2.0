import { SetupError } from "@/lib/http";
import { isPublicConfigured } from "@/lib/public-env";

export function isDatabaseConfigured() {
  return isPublicConfigured() && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getPublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new SetupError();
  return { url, anonKey };
}

export function getServerEnv() {
  const { url, anonKey } = getPublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) throw new SetupError();
  return {
    url,
    anonKey,
    serviceRoleKey,
    appBaseUrl: process.env.APP_BASE_URL?.replace(/\/$/, "") ?? "",
  };
}
