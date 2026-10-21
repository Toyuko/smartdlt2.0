"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getPublicConfig } from "@/lib/public-env";

export function createSupabaseBrowserClient() {
  const env = getPublicConfig();
  return createBrowserClient(env.url, env.anonKey);
}
