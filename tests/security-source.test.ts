import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return files(full);
    return full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
  });
}

describe("security boundaries", () => {
  it("does not reference the service role from client modules", () => {
    const roots = ["app", "components", "lib"];
    const offenders = roots
      .flatMap((root) => files(root))
      .filter((file) => readFileSync(file, "utf8").includes("'use client'") || readFileSync(file, "utf8").includes('"use client"'))
      .filter((file) => /SUPABASE_SERVICE_ROLE_KEY|createAdminClient/.test(readFileSync(file, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("stores a token hash rather than a raw verification token", () => {
    const sql = readFileSync("supabase/migrations/20261021143000_init.sql", "utf8");
    expect(sql).toContain("verification_token_hash");
    expect(sql).not.toMatch(/verification_token\s+text/);
    expect(sql.toLowerCase()).not.toContain("passport");
    expect(sql.toLowerCase()).not.toContain("national_id");
    const guidance = readFileSync("supabase/migrations/20261022013000_booking_ticket_guidance.sql", "utf8");
    expect(guidance).toContain("document_guidance");
    expect(guidance).not.toMatch(/verification_token\s+text/);
    expect(sql).toContain("for update");
    expect(sql).toContain("enable row level security");
  });

  it("checks staff authorisation in every staff route", () => {
    const routes = files("app/api/staff");
    for (const file of routes) {
      expect(readFileSync(file, "utf8")).toContain("requireStaff");
    }
  });
});
