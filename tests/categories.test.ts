import { describe, expect, it } from "vitest";
import { createDemoBooking, type BookingWriter } from "@/lib/booking/create-booking";
import {
  activeOptions,
  applicableAnswers,
  bookingCategorySeed,
  buildWizardSteps,
  categoryBySlug,
  describeRenewalRules,
  evaluateRenewal,
  selectDocumentSet,
  validateSelection,
  visibleFields,
  type BookingCategory,
} from "@/lib/booking/categories";
import { serviceSeed } from "@/lib/demo-catalog";
import { HttpError } from "@/lib/http";
import { bookingRequestSchema } from "@/lib/booking/validation";

const today = "2026-10-21";

function category(slug: string) {
  const found = categoryBySlug(slug);
  if (!found) throw new Error(slug);
  return found;
}

function selection(overrides: Parameters<typeof validateSelection>[0]) {
  return validateSelection(overrides);
}

describe("booking categories", () => {
  it("seeds the six demonstration categories with bilingual names and guidance", () => {
    expect(bookingCategorySeed.map((item) => item.name)).toEqual([
      "New Thai Driving Licence",
      "Foreign Licence Conversion",
      "Thai Driving Licence Renewal",
      "Change or Replace a Licence",
      "International Driving Permit",
      "Other Demonstration Services",
    ]);
    for (const item of bookingCategorySeed) {
      expect(item.nameTh.length).toBeGreaterThan(0);
      expect(item.description.length).toBeGreaterThan(0);
      expect(item.icon.length).toBeGreaterThan(0);
      expect(item.active).toBe(true);
      expect(item.documentSets.length).toBeGreaterThan(0);
      expect(item.eligibleOfficeSlugs.length).toBeGreaterThan(0);
      expect(item.slotRules.timezone).toBe("Asia/Bangkok");
      expect(item.slotRules.horizonDays).toBeGreaterThan(0);
    }
  });

  it("asks category-specific questions and omits an expiry date for a new licence", () => {
    expect(visibleFields(category("new-thai-licence"), "new-car").map((field) => field.key)).not.toContain("expiryDate");
    expect(visibleFields(category("foreign-conversion"), "conversion").map((field) => field.key)).toEqual([
      "issuingCountry",
      "foreignLicenceClass",
      "foreignValid",
      "foreignLanguage",
    ]);
    expect(visibleFields(category("thai-renewal"), "renewal-car").map((field) => field.key)).toEqual([
      "currentLicenceType",
      "expiryDate",
    ]);
    expect(visibleFields(category("change-or-replace"), "replace-card").map((field) => field.key)).toEqual(["replacementReason"]);
    expect(visibleFields(category("change-or-replace"), "update-details").map((field) => field.key)).toEqual(["detailToUpdate"]);
    expect(visibleFields(category("change-or-replace"), "change-type")).toEqual([]);
    expect(visibleFields(category("international-permit"), "idp")).toEqual([]);
    expect(visibleFields(category("other-demo"), "general-counter")).toEqual([]);
  });

  it("clears answers that do not belong to the newly selected category or service", () => {
    const stale = {
      expiryDate: "2026-11-01",
      currentLicenceType: "temporary",
      issuingCountry: "japan",
      replacementReason: "lost",
    };
    expect(applicableAnswers(category("new-thai-licence"), "new-car", stale)).toEqual({});
    expect(applicableAnswers(category("thai-renewal"), "renewal-car", stale)).toEqual({
      expiryDate: "2026-11-01",
      currentLicenceType: "temporary",
    });
    expect(applicableAnswers(category("change-or-replace"), "update-details", stale)).toEqual({});
    expect(applicableAnswers(category("change-or-replace"), "replace-card", stale)).toEqual({ replacementReason: "lost" });
  });

  it("keeps disabled subcategory options and services out of the active choices", () => {
    const licenceType = visibleFields(category("thai-renewal"), "renewal-car").find((field) => field.key === "currentLicenceType");
    expect(activeOptions(licenceType!).map((option) => option.value)).toEqual(["temporary", "five_year"]);
    expect(serviceSeed.find((service) => service.slug === "class-upgrade")?.active).toBe(false);
    expect(serviceSeed.filter((service) => service.active !== false).some((service) => service.slug === "class-upgrade")).toBe(false);
  });

  it("selects one document checklist from the applicant, class, and service", () => {
    const fresh = category("new-thai-licence");
    const thaiCar = selectDocumentSet(fresh, {
      applicantCategory: "thai",
      serviceSlug: "new-car",
      licenceClass: "car",
      licenceType: "",
    });
    const foreign = selectDocumentSet(fresh, {
      applicantCategory: "foreign",
      serviceSlug: "new-car",
      licenceClass: "car",
      licenceType: "",
    });
    expect(thaiCar.id).toBe("new-thai-car");
    expect(foreign.id).toBe("new-foreign");
    expect(thaiCar.id).not.toBe(foreign.id);
    expect(thaiCar.items).toHaveLength(3);
    const renewal = category("thai-renewal");
    expect(
      selectDocumentSet(renewal, { applicantCategory: "thai", serviceSlug: "renewal-car", licenceClass: "car", licenceType: "temporary" }).id,
    ).toBe("renewal-temporary");
    expect(
      selectDocumentSet(renewal, { applicantCategory: "thai", serviceSlug: "renewal-car", licenceClass: "car", licenceType: "five_year" }).id,
    ).toBe("renewal-five-year");
    expect(selectDocumentSet(category("international-permit"), {
      applicantCategory: "thai",
      serviceSlug: "idp",
      licenceClass: "car",
      licenceType: "",
    }).id).toBe("idp-checklist");
  });

  it("validates dates and blocks a renewal outside the configurable demo window", () => {
    const renewal = category("thai-renewal");
    expect(describeRenewalRules(renewal.slotRules, "en")).toContain("60");
    expect(describeRenewalRules(renewal.slotRules, "en")).toContain("not a legal determination");
    expect(evaluateRenewal(renewal, { currentLicenceType: "temporary", expiryDate: "2026-13-40" }, today).state).toBe("invalid_date");
    expect(evaluateRenewal(renewal, { currentLicenceType: "temporary", expiryDate: "2027-06-01" }, today).state).toBe("outside");
    expect(evaluateRenewal(renewal, { currentLicenceType: "temporary", expiryDate: "2026-11-01" }, today).state).toBe("ok");
    expect(evaluateRenewal(renewal, { currentLicenceType: "five_year", expiryDate: "2026-10-01" }, today).state).toBe("ok");
    const blocked = selection(baseSelection(renewal, { currentLicenceType: "temporary", expiryDate: "2027-06-01" }));
    expect(blocked.ok).toBe(false);
    expect(blocked.fieldErrors.expiryDate).toBe("renewal_window");
    expect(blocked.answers).not.toHaveProperty("issuingCountry");
  });

  it("rejects an office that is not eligible for the category", () => {
    const permit = category("international-permit");
    const coastal = selection({
      ...baseSelection(permit, {}),
      officeSlug: "coastal",
      serviceSlug: "idp",
      requiresVehicle: true,
      vehicleCategory: "car",
    });
    expect(coastal.fieldErrors.officeId).toBe("office_ineligible");
    const canal = selection({
      ...baseSelection(permit, {}),
      officeSlug: "canal",
      serviceSlug: "idp",
      requiresVehicle: true,
      vehicleCategory: "car",
    });
    expect(canal.ok).toBe(true);
  });

  it("builds a shorter wizard when vehicle and extra questions are not required", () => {
    expect(buildWizardSteps({ requiresVehicle: false, hasQuestions: false })).toEqual([
      "applicantCategory",
      "office",
      "category",
      "service",
      "applicant",
      "documents",
      "schedule",
      "review",
    ]);
    expect(buildWizardSteps({ requiresVehicle: true, hasQuestions: true })).toContain("vehicle");
    expect(buildWizardSteps({ requiresVehicle: true, hasQuestions: true })).toContain("questions");
  });

  it("rejects an invalid expiry before a booking is reserved", async () => {
    let reserved = false;
    const writer: BookingWriter = {
      consumeRateLimit: async () => true,
      loadContext: async () => ({
        officeSlug: "canal",
        officeActive: true,
        serviceSlug: "renewal-car",
        serviceActive: true,
        requiresVehicle: false,
        category: category("thai-renewal"),
      }),
      reserve: async () => {
        reserved = true;
        return { idempotent: false, id: "1", reference: "VD-TEST-BOOK", status: "confirmed" };
      },
      getPublicById: async () => null,
    };
    const parsed = bookingRequestSchema.safeParse({
      officeId: "11111111-1111-4111-8111-111111111111",
      serviceId: "22222222-2222-4222-8222-222222222222",
      vehicleCategory: "",
      applicantDisplayName: "Sample Visitor",
      contactEmail: "",
      contactPhone: "",
      notes: "",
      timeSlotId: "33333333-3333-4333-8333-333333333333",
      acceptDisclaimer: true,
      idempotencyKey: "44444444-4444-4444-8444-444444444444",
      applicantCategory: "thai",
      categorySlug: "thai-renewal",
      answers: { currentLicenceType: "temporary", expiryDate: "2099-01-01" },
    });
    expect(parsed.success).toBe(true);
    await expect(
      createDemoBooking(writer, parsed.success ? parsed.data : {}, { keyHash: "ip", origin: "https://demo.example" }),
    ).rejects.toBeInstanceOf(HttpError);
    expect(reserved).toBe(false);
  });
});

function baseSelection(item: BookingCategory, answers: Record<string, string>): Parameters<typeof validateSelection>[0] {
  return {
    officeSlug: "canal",
    officeActive: true,
    serviceSlug: "renewal-car",
    serviceActive: true,
    requiresVehicle: false,
    category: item,
    applicantCategory: "thai",
    categorySlug: item.slug,
    vehicleCategory: "",
    answers,
    today,
  };
}
