import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});
import { MonthCalendar } from "@/components/booking/month-calendar";
import { BookingSummary } from "@/components/booking/summary";
import { DocumentGuidance } from "@/components/booking/document-guidance";
import { AppProviders } from "@/components/language";
import { categoryBySlug, selectDocumentSet } from "@/lib/booking/categories";
import { DEMO_NOTICE, SAMPLE_GUIDANCE_NOTE } from "@/lib/demo-notice";
import type { PublicBooking } from "@/lib/booking/public-view";

describe("demonstration interface", () => {
  it("shows the persistent English notice", () => {
    render(
      <AppProviders>
        <p>Page</p>
      </AppProviders>,
    );
    expect(screen.getByTestId("demo-banner")).toHaveTextContent(DEMO_NOTICE);
  });

  it("switches visible copy to Thai", async () => {
    render(
      <AppProviders>
        <p>Page</p>
      </AppProviders>,
    );
    await userEvent.click(screen.getByRole("button", { name: "ไทย" }));
    expect(screen.getByRole("link", { name: "หน้าแรก" })).toBeInTheDocument();
  });

  it("does not select a past or full day", async () => {
    const onSelect = vi.fn();
    render(
      <AppProviders>
        <MonthCalendar
          monthKey="2026-10"
          today="2026-10-21"
          selectedDate=""
          days={{ "2026-10-22": "available", "2026-10-23": "full", "2026-10-24": "unavailable" }}
          canPrev={false}
          canNext
          onMonth={vi.fn()}
          onSelect={onSelect}
        />
      </AppProviders>,
    );
    await userEvent.click(screen.getByRole("button", { name: /2026-10-20/ }));
    await userEvent.click(screen.getByRole("button", { name: /2026-10-23/ }));
    await userEvent.click(screen.getByRole("button", { name: /2026-10-22/ }));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith("2026-10-22");
  });

  it("shows one document checklist and the disclaimer on verification and print summaries", () => {
    const category = categoryBySlug("new-thai-licence");
    const set = selectDocumentSet(category!, {
      applicantCategory: "thai",
      serviceSlug: "new-car",
      licenceClass: "car",
      licenceType: "",
    });
    const booking: PublicBooking = {
      id: "11111111-1111-4111-8111-111111111111",
      reference: "VD-TEST-BOOK",
      status: "cancelled",
      applicantDisplayName: "Sample Visitor",
      vehicleCategory: null,
      officeName: "SmartDLT2.0 Canal Demo",
      officeNameTh: "คลอง",
      province: "Bangkok",
      provinceTh: "กรุงเทพมหานคร",
      demoLabel: "Demo location — not an official DLT office",
      serviceName: "First-time application — car",
      serviceNameTh: "คำขอครั้งแรก — รถยนต์",
      serviceSlug: "new-car",
      category: "new-thai-licence",
      categoryLabel: "New Thai Driving Licence",
      categoryLabelTh: "ใบอนุญาตขับขี่ไทยใหม่",
      applicantCategory: "thai",
      answers: {},
      startsAt: "2026-10-29T01:00:00.000Z",
      endsAt: "2026-10-29T02:00:00.000Z",
    };
    render(
      <AppProviders>
        <DocumentGuidance set={set} />
        <BookingSummary booking={booking} outcome="cancelled" />
        <p className="print-card" data-testid="print-disclaimer">
          {DEMO_NOTICE}
        </p>
      </AppProviders>,
    );
    expect(screen.getAllByTestId("document-guidance")).toHaveLength(1);
    expect(screen.getByText(SAMPLE_GUIDANCE_NOTE)).toBeInTheDocument();
    expect(screen.getByText(/Original/)).toBeInTheDocument();
    expect(screen.getByTestId("verify-disclaimer")).toHaveTextContent(DEMO_NOTICE);
    expect(screen.getByTestId("print-disclaimer")).toHaveTextContent(DEMO_NOTICE);
    expect(screen.getByText("New Thai Driving Licence")).toBeInTheDocument();
    expect(screen.getByText("Cancelled")).toBeInTheDocument();
  });
});
