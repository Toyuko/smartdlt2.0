import { createHash, randomBytes, randomInt } from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function hashRateLimitKey(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function generateReference() {
  const chars = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
  return `VD-${chars.slice(0, 4)}-${chars.slice(4)}`;
}
