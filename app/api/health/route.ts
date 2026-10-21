import { connection } from "next/server";
import { isDatabaseConfigured } from "@/lib/env";
import { json } from "@/lib/http";

export async function GET() {
  await connection();
  const configured = isDatabaseConfigured();
  return json(
    { ok: configured, service: "violet-desk-demo", database: configured ? "configured" : "missing" },
    configured ? 200 : 503,
  );
}
