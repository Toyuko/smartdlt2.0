import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QuickSignup } from "@/components/staff/quick-signup";
import { formatBookingDate, formatTime } from "@/lib/time";

const officeId = "11111111-1111-4111-8111-111111111111";
const serviceId = "22222222-2222-4222-8222-222222222222";
const slotId = "33333333-3333-4333-8333-333333333333";

const catalog = {
  offices: [
    {
      id: officeId,
      slug: "riverside",
      name: "SmartDLT2.0 Riverside Demo",
      nameTh: "SmartDLT2.0 สาขาสาธิตริมน้ำ",
      province: "Chiang Mai",
      provinceTh: "เชียงใหม่",
      demoLabel: "Demo location — not an official DLT office",
    },
  ],
  services: [
    {
      id: serviceId,
      slug: "new-car",
      name: "First-time application — car",
      nameTh: "คำขอครั้งแรก — รถยนต์",
      category: "new-thai-licence",
      categoryTh: "ใบอนุญาตขับขี่ไทยใหม่",
      requiresVehicle: false,
      documentGuidance: { summaryEn: "", summaryTh: "", items: [] },
    },
  ],
  vehicles: [],
  categories: [],
};

function json(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response);
}

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("staff quick signup", () => {
  it("reserves the next seat and clears the customer so another can be entered", async () => {
    const user = userEvent.setup();
    const posted: unknown[] = [];
    const start = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    start.setUTCMinutes(0, 0, 0);
    const startsAt = start.toISOString();
    const endsAt = new Date(start.getTime() + 60 * 60 * 1000).toISOString();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.startsWith("/api/catalog")) return json(catalog);
        if (url.startsWith("/api/availability")) {
          return json({
            slots: [{ id: slotId, starts_at: startsAt, ends_at: endsAt, capacity: 4, remaining: 3 }],
          });
        }
        if (url === "/api/staff/bookings" && init?.method === "POST") {
          posted.push(JSON.parse(String(init.body)));
          return json({ reference: "VD-TEST-BOOK", verificationUrl: "https://demo.example/demo-ticket/opaque-token" }, 201);
        }
        return json({ error: "not_found" }, 404);
      }),
    );

    render(<QuickSignup />);

    const slotText = `${formatBookingDate(startsAt)} ${formatTime(startsAt)}`;
    expect(await screen.findByRole("option", { name: new RegExp(slotText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) })).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Display name" }), "Sample Visitor");
    await user.click(screen.getByRole("checkbox", { name: /demonstration booking/ }));
    await user.click(screen.getByRole("button", { name: "Add customer" }));

    expect(await screen.findByRole("status")).toHaveTextContent("VD-TEST-BOOK");
    expect(screen.getByRole("textbox", { name: "Display name" })).toHaveValue("");
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({
      officeId,
      serviceId,
      applicantDisplayName: "Sample Visitor",
      applicantCategory: "thai",
      timeSlotId: slotId,
      acceptDisclaimer: true,
      categorySlug: "new-thai-licence",
    });
    expect(window.sessionStorage.getItem("vd-verify-url:VD-TEST-BOOK")).toBe("https://demo.example/demo-ticket/opaque-token");
  });
});
