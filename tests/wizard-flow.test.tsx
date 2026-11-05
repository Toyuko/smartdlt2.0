import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BookingWizard } from "@/components/booking/booking-wizard";
import { AppProviders } from "@/components/language";
import { bookingCategorySeed } from "@/lib/booking/categories";
import { DEMO_NOTICE } from "@/lib/demo-notice";

const officeId = "11111111-1111-4111-8111-111111111111";
const coastalId = "12121212-1212-4121-8121-121212121212";
const carId = "22222222-2222-4222-8222-222222222222";
const renewalId = "23232323-2323-4232-8232-232323232323";
const conversionId = "24242424-2424-4242-8242-242424242424";

const catalog = {
  offices: [
    {
      id: officeId,
      slug: "bkk-area-1",
      name: "Bangkok Transport Office Area 1 (Bang Khun Thian)",
      nameTh: "สำนักงานขนส่งกรุงเทพมหานครพื้นที่ 1 (บางขุนเทียน)",
      province: "Bangkok",
      provinceTh: "กรุงเทพมหานคร",
      demoLabel: "Demo location — not an official DLT office",
    },
    {
      id: coastalId,
      slug: "coastal",
      name: "SmartDLT2.0 Coastal Demo",
      nameTh: "SmartDLT2.0 สาขาสาธิตชายฝั่ง",
      province: "Phuket",
      provinceTh: "ภูเก็ต",
      demoLabel: "Demo location — not an official DLT office",
    },
  ],
  services: [
    service(carId, "new-car", "First-time application — car", "new-thai-licence", false),
    service(renewalId, "renewal-car", "Renewal — car", "thai-renewal", false),
    service(conversionId, "conversion", "Convert a foreign licence", "foreign-conversion", false),
  ],
  vehicles: [{ slug: "car", name: "Car", nameTh: "รถยนต์" }],
  categories: bookingCategorySeed,
};

function service(id: string, slug: string, name: string, categorySlug: string, requiresVehicle: boolean) {
  return {
    id,
    slug,
    name,
    nameTh: name,
    category: categorySlug,
    categoryTh: categorySlug,
    requiresVehicle,
    documentGuidance: { summaryEn: "", summaryTh: "", items: [] },
  };
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("wizard navigation", () => {
  it("walks applicant, office, and category on a compact vertical stepper", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(catalog)));
    const user = userEvent.setup();
    render(
      <AppProviders>
        <BookingWizard />
      </AppProviders>,
    );
    expect(await screen.findByTestId("wizard-compact-progress")).toHaveTextContent("1 /");
    expect(screen.getByTestId("wizard-steps").className).toContain("flex-col");
    expect(screen.getByTestId("wizard-disclaimer")).toHaveTextContent(DEMO_NOTICE);
    await user.click(screen.getByRole("radio", { name: /Thai applicant/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Bangkok" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Area 1/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("radio", { name: /New Thai Driving Licence/ })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /International Driving Permit/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "✓Applicant" }));
    expect(screen.getByRole("radio", { name: /Thai applicant/ })).toBeChecked();
  });

  it("drops renewal questions after the category changes and continues past an expiry outside the demo window", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/availability")) return Response.json({ slots: [] });
      return Response.json(catalog);
    }));
    const user = userEvent.setup();
    render(
      <AppProviders>
        <BookingWizard />
      </AppProviders>,
    );
    await screen.findByTestId("wizard-compact-progress");
    await user.click(screen.getByRole("radio", { name: /Thai applicant/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("radio", { name: /Area 1/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("radio", { name: /Thai Driving Licence Renewal/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("radio", { name: /Renewal — car/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Please complete the following." })).toBeInTheDocument();
    expect(screen.getByLabelText("Day")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Lost driving license." })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Country that issued the existing licence/)).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Day"), "01");
    await user.selectOptions(screen.getByLabelText("Month"), "06");
    await user.selectOptions(screen.getByLabelText("Year"), "2028");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByText(/outside the configured demonstration window/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Display name")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await user.click(screen.getByRole("radio", { name: /Foreign Licence Conversion/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("radio", { name: /Convert a foreign licence/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText(/Country that issued the existing licence/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Day")).not.toBeInTheDocument();
  });

  it("hides the permit category at an office that is not eligible", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(catalog)));
    const user = userEvent.setup();
    render(
      <AppProviders>
        <BookingWizard />
      </AppProviders>,
    );
    await screen.findByRole("radio", { name: /Thai applicant/ });
    await user.click(screen.getByRole("radio", { name: /Thai applicant/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("radio", { name: /Coastal Demo/ }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByRole("radio", { name: /International Driving Permit/ })).not.toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /New Thai Driving Licence/ })).toBeInTheDocument();
  });
});
