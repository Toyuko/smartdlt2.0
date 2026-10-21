export const BOOKING_STATUSES = ["confirmed", "checked_in", "completed", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type VerificationOutcome =
  | "valid"
  | "already_checked_in"
  | "cancelled"
  | "completed"
  | "expired"
  | "invalid"
  | "not_found";

export function decideVerificationOutcome(input: { status: BookingStatus; endsAt: string; now?: Date }): VerificationOutcome {
  if (input.status === "cancelled") return "cancelled";
  if (input.status === "checked_in") return "already_checked_in";
  if (input.status === "completed") return "completed";
  if (new Date(input.endsAt).getTime() <= (input.now ?? new Date()).getTime()) return "expired";
  return "valid";
}
