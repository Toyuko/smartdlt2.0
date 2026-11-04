import { createHash, randomBytes, randomInt } from "node:crypto";
import { bangkokDateParts } from "@/lib/time";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashRateLimitKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function generateReference(now = new Date()) {
  const parts = bangkokDateParts(now);
  const date = `${parts.year}${String(parts.month).padStart(2, "0")}${String(parts.day).padStart(2, "0")}`;
  const digits = Array.from({ length: 6 }, () => String(randomInt(10))).join("");
  const letters = Array.from({ length: 3 }, () => LETTERS[randomInt(LETTERS.length)]).join("");
  return `W${date}${digits}${letters}`;
}
