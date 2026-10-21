import "server-only";

import { isReference, isTicketToken } from "@/lib/booking/codes";
import { decideVerificationOutcome, type VerificationOutcome } from "@/lib/booking/outcomes";
import type { PublicBooking } from "@/lib/booking/public-view";
import { hashToken } from "@/lib/booking/tokens";
import { getPublicByReference, getPublicByTokenHash } from "@/lib/data/store";
import { SetupError } from "@/lib/http";

export type TicketLoad =
  | { state: "invalid" }
  | { state: "not_found" }
  | { state: "unavailable" }
  | { state: "ready"; booking: PublicBooking; outcome: VerificationOutcome };

function fromError(error: unknown): TicketLoad {
  if (error instanceof SetupError) throw error;
  return { state: "unavailable" };
}

export async function loadTicketByToken(token: string): Promise<TicketLoad> {
  if (!isTicketToken(token)) return { state: "invalid" };
  try {
    const booking = await getPublicByTokenHash(hashToken(token));
    if (!booking) return { state: "invalid" };
    return { state: "ready", booking, outcome: decideVerificationOutcome(booking) };
  } catch (error) {
    return fromError(error);
  }
}

export async function loadTicketByReference(reference: string): Promise<TicketLoad> {
  const normalized = reference.toUpperCase();
  if (!isReference(normalized)) return { state: "not_found" };
  try {
    const booking = await getPublicByReference(normalized);
    if (!booking) return { state: "not_found" };
    return { state: "ready", booking, outcome: decideVerificationOutcome(booking) };
  } catch (error) {
    return fromError(error);
  }
}
