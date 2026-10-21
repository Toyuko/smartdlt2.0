import { z } from "zod";

const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, "invalid_id");
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9][0-9\s()-]{6,18}$/;

function looksLikeGovernmentNumber(value: string) {
  return /\d{9,}/.test(value.replace(/[\s-]/g, ""));
}

function rejectGovernmentNumbers(value: string, ctx: z.RefinementCtx, path: string) {
  if (looksLikeGovernmentNumber(value)) {
    ctx.addIssue({ code: "custom", message: "no_government_id", path: [path] });
  }
}

export const bookingRequestSchema = z
  .object({
    officeId: uuid,
    serviceId: uuid,
    vehicleCategory: z.string().trim().max(40),
    applicantDisplayName: z.string().trim().min(2, "name_short").max(80, "name_long"),
    contactEmail: z.string().trim().max(120),
    contactPhone: z.string().trim().max(20),
    notes: z.string().trim().max(500, "notes_long"),
    timeSlotId: uuid,
    acceptDisclaimer: z.boolean(),
    idempotencyKey: uuid,
  })
  .superRefine((value, ctx) => {
    if (!value.acceptDisclaimer) {
      ctx.addIssue({ code: "custom", message: "disclaimer_required", path: ["acceptDisclaimer"] });
    }
    if (value.contactEmail && !emailPattern.test(value.contactEmail)) {
      ctx.addIssue({ code: "custom", message: "email_invalid", path: ["contactEmail"] });
    }
    if (value.contactPhone && !phonePattern.test(value.contactPhone)) {
      ctx.addIssue({ code: "custom", message: "phone_invalid", path: ["contactPhone"] });
    }
    rejectGovernmentNumbers(value.applicantDisplayName, ctx, "applicantDisplayName");
    rejectGovernmentNumbers(value.contactPhone, ctx, "contactPhone");
    rejectGovernmentNumbers(value.notes, ctx, "notes");
    rejectGovernmentNumbers(value.contactEmail, ctx, "contactEmail");
  });

export type BookingRequest = z.infer<typeof bookingRequestSchema>;

export function fieldErrorsFromZod(error: z.ZodError) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !fieldErrors[key]) {
      fieldErrors[key] = issue.message;
    }
  }
  return fieldErrors;
}

export const lookupSchema = z.object({
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^VD-[A-Z2-9]{4}-[A-Z2-9]{4}$/, "reference_invalid"),
});

export const transitionSchema = z.object({
  action: z.enum(["check_in", "complete", "cancel"]),
});

export const availabilityQuerySchema = z.object({
  officeId: uuid,
  serviceId: uuid,
  month: z.string().regex(/^\d{4}-\d{2}$/, "month_invalid"),
});

export const staffFilterSchema = z.object({
  reference: z.string().trim().max(20).optional().default(""),
  officeId: z.string().optional().default(""),
  serviceId: z.string().optional().default(""),
  status: z.enum(["confirmed", "checked_in", "completed", "cancelled", ""]).optional().default(""),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .or(z.literal(""))
    .default(""),
});
