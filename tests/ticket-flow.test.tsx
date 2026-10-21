import { readFileSync } from "node:fs";
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConfirmationScreen } from "@/components/booking/confirmation";
import { ElectronicTicket, TicketMissing, TicketUnavailable } from "@/components/booking/electronic-ticket";
import { AppProviders } from "@/components/language";
import { categoryBySlug, snapshotGuidance } from "@/lib/booking/categories";
import { createDemoBooking, type BookingWriter } from "@/lib/booking/create-booking";
import { DATABASE_RETRY, TICKET_STATUS } from "@/lib/booking/ticket-view";
import { formatBookingDate, formatSlotRange } from "@/lib/time";
import { DEMO_NOTICE, DEMO_QR_CODE_WARNING } from "@/lib/demo-notice";
import type { PublicBooking } from "@/lib/booking/public-view";

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(async () => "data:image/png;base64,iVBORw0KGgo="),
    toCanvas: vi.fn(async (canvas: HTMLCanvasElement) => {
      canvas.width = 280;
      canvas.height = 280;
    }),
  },
}));

const ticketUrl = "https://demo.example/demo-ticket/abcdefghijklmnopqrstuvwxyz0123456789AB";
const startsAt = "2026-10-29T01:00:00.000Z";
const endsAt = "2026-10-29T02:00:00.000Z";

const foreignGuidance = snapshotGuidance(categoryBySlug("new-thai-licence") ?? null, {
  applicantCategory: "foreign",
  serviceSlug: "new-motorcycle",
  licenceClass: "motorcycle",
  licenceType: "",
});

const booking: PublicBooking = {
  id: "11111111-1111-4111-8111-111111111111",
  reference: "VD-TEST-BOOK",
  status: "confirmed",
  applicantDisplayName: "Sample Visitor",
  vehicleCategory: "motorcycle",
  officeName: "SmartDLT2.0 Riverside Demo Office with a long display name",
  officeNameTh: "สำนักงานสาธิตชื่อยาว",
  province: "Chiang Mai",
  provinceTh: "เชียงใหม่",
  demoLabel: "Demo location — not an official DLT office",
  serviceName: "First-time application — motorcycle",
  serviceNameTh: "คำขอครั้งแรก — รถจักรยานยนต์",
  serviceSlug: "new-motorcycle",
  category: "new-thai-licence",
  categoryLabel: "New Thai Driving Licence",
  categoryLabelTh: "ใบอนุญาตขับขี่ไทยใหม่",
  applicantCategory: "foreign",
  answers: {},
  guidance: foreignGuidance,
  startsAt,
  endsAt,
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function renderConfirmation(current: PublicBooking = booking) {
  return render(
    <AppProviders>
      <ConfirmationScreen booking={current} outcome="valid" initialTicketUrl={ticketUrl} />
    </AppProviders>,
  );
}

describe("booking confirmation and electronic ticket", () => {
  it("shows the saved appointment, office, and demo-ticket QR", async () => {
    renderConfirmation();
    expect(formatBookingDate(startsAt)).toBe("29/10/2026");
    expect(formatSlotRange(startsAt, endsAt)).toBe("08:00–09:00 AM");
    expect(screen.getByRole("heading", { name: "Booking information" })).toBeInTheDocument();
    expect(screen.getByText("29/10/2026")).toBeInTheDocument();
    expect(screen.getByText("08:00–09:00 AM")).toBeInTheDocument();
    expect(screen.getByText("New Thai Driving Licence")).toBeInTheDocument();
    expect(screen.getByText("First-time application — motorcycle")).toBeInTheDocument();
    expect(screen.getByText("Sample Visitor")).toBeInTheDocument();
    expect(screen.getByText("Chiang Mai")).toBeInTheDocument();
    expect(screen.getByTestId("office-name")).toHaveTextContent("SmartDLT2.0 Riverside Demo Office with a long display name");
    expect(screen.getByTestId("office-name").className).toContain("break-words");
    expect(screen.getByText("Motorcycle")).toBeInTheDocument();
    expect(screen.getByTestId("qr-print")).toHaveAttribute("data-qr-payload", ticketUrl);
    expect(screen.getByTestId("qr-warning")).toHaveTextContent(DEMO_QR_CODE_WARNING);
    expect(screen.getByTestId("print-disclaimer")).toHaveTextContent(DEMO_NOTICE);
    expect(screen.getByTestId("confirmation-layout").className).toContain("max-w-md");
    expect(screen.getByTestId("confirmation-layout").className).toContain("lg:max-w-xl");
    expect(screen.getByTestId("confirmation-layout").className).toContain("overflow-x-hidden");
    await userEvent.click(screen.getByRole("button", { name: "Required Documents to Prepare" }));
    expect(screen.getByText("Sample checklist — foreign applicant")).toBeInTheDocument();
    expect(screen.queryByText("Sample checklist — Thai applicant, car")).not.toBeInTheDocument();
    expect(screen.getByText("Demo dress code for a sample physical test")).toBeInTheDocument();
  });

  it("downloads a PNG and keeps the disclaimer and QR in the print layout", async () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      fillStyle: "",
      font: "",
      textAlign: "",
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      fillText: vi.fn(),
      measureText: () => ({ width: 20 }),
    })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,iVBORw0KGgo=");
    const downloads: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloads.push(`${this.download} ${this.href}`);
    });
    const print = vi.fn();
    window.print = print;
    renderConfirmation();
    await userEvent.click(screen.getByRole("button", { name: "Save QR" }));
    expect(downloads[0]).toContain("smartdlt2.0-VD-TEST-BOOK.png");
    expect(downloads[0]).toContain("data:image/png");
    await userEvent.click(screen.getByRole("button", { name: "Print confirmation" }));
    expect(print).toHaveBeenCalled();
    expect(screen.getByTestId("print-disclaimer").className).not.toContain("no-print");
    expect(screen.getByTestId("qr-print").className).toContain("qr-print");
    expect(screen.getByRole("button", { name: "Print confirmation" }).parentElement).toHaveClass("no-print");
    const css = readFileSync("app/globals.css", "utf8");
    expect(css).toContain("break-inside: avoid");
    expect(css).toContain(".print-disclaimer");
    expect(css).toContain(".qr-print");
  });

  it("renders the electronic ticket from the booking record without session storage", () => {
    const getItem = vi.spyOn(window.sessionStorage, "getItem");
    render(
      <AppProviders>
        <ElectronicTicket booking={booking} outcome="valid" ticketUrl={ticketUrl} imageSrc="data:image/png;base64,iVBORw0KGgo=" staff={null} />
      </AppProviders>,
    );
    expect(getItem).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Electronic Booking Ticket (Demo)" })).toBeInTheDocument();
    expect(screen.getByText("ใบนัดอิเล็กทรอนิกส์ (ระบบสาธิต)")).toBeInTheDocument();
    expect(screen.getByTestId("ticket-status")).toHaveTextContent(TICKET_STATUS.valid);
    expect(screen.getByTestId("qr-print")).toHaveAttribute("data-qr-payload", ticketUrl);
    expect(screen.getByRole("link", { name: "Return to booking confirmation" })).toHaveAttribute("href", "/booking-confirmation/VD-TEST-BOOK");
    expect(screen.getByTestId("ticket-guidance")).toHaveTextContent("Sample checklist — foreign applicant");
    expect(screen.getByTestId("ticket-sheet").className).toContain("max-w-lg");
    expect(screen.queryByRole("button", { name: "Check in" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("staff-demo-actions")).not.toBeInTheDocument();
  });

  it("shows cancelled and completed demo statuses and blocks a second check-in", () => {
    render(
      <AppProviders>
        <ElectronicTicket booking={{ ...booking, status: "cancelled" }} outcome="cancelled" ticketUrl={ticketUrl} imageSrc="data:image/png;base64,iVBORw0KGgo=" staff={null} />
      </AppProviders>,
    );
    expect(screen.getByTestId("ticket-status")).toHaveTextContent("Cancelled — demo record.");
    cleanup();
    render(
      <AppProviders>
        <ElectronicTicket
          booking={{ ...booking, status: "completed" }}
          outcome="completed"
          ticketUrl={ticketUrl}
          imageSrc="data:image/png;base64,iVBORw0KGgo="
          staff={{ bookingId: booking.id, status: "completed" }}
        />
      </AppProviders>,
    );
    expect(screen.getByTestId("ticket-status")).toHaveTextContent("Completed — demo record.");
    expect(screen.getByRole("button", { name: "Check in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mark completed" })).toBeDisabled();
    cleanup();
    render(
      <AppProviders>
        <ElectronicTicket
          booking={{ ...booking, status: "checked_in" }}
          outcome="already_checked_in"
          ticketUrl={ticketUrl}
          imageSrc="data:image/png;base64,iVBORw0KGgo="
          staff={{ bookingId: booking.id, status: "checked_in" }}
        />
      </AppProviders>,
    );
    expect(screen.getByTestId("ticket-status")).toHaveTextContent("Already checked in — demo record.");
    expect(screen.getByRole("button", { name: "Check in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Mark completed" })).toBeEnabled();
  });

  it("rejects a duplicate check-in from the staff action", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: "already_checked_in" }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AppProviders>
        <ElectronicTicket
          booking={booking}
          outcome="valid"
          ticketUrl={ticketUrl}
          imageSrc="data:image/png;base64,iVBORw0KGgo="
          staff={{ bookingId: booking.id, status: "confirmed" }}
        />
      </AppProviders>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Check in" }));
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/staff/bookings/${booking.id}/transition`,
      expect.objectContaining({ method: "POST", body: JSON.stringify({ action: "check_in" }) }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("This demo booking is already checked in.");
    expect(screen.getByRole("button", { name: "Check in" })).toBeDisabled();
  });

  it("explains a missing token and a database outage without inventing a booking", () => {
    render(<TicketMissing />);
    expect(screen.getByRole("alert")).toHaveTextContent("Demo booking not found.");
    expect(screen.queryByText("Sample Visitor")).not.toBeInTheDocument();
    cleanup();
    render(<TicketUnavailable />);
    expect(screen.getByTestId("ticket-retry")).toHaveTextContent(DATABASE_RETRY);
    expect(screen.queryByText("Sample Visitor")).not.toBeInTheDocument();
  });

  it("verifies the ticket on the server with a token hash", () => {
    const source = readFileSync("lib/booking/ticket.ts", "utf8");
    const page = readFileSync("app/demo-ticket/[token]/page.tsx", "utf8");
    const transition = readFileSync("app/api/staff/bookings/[id]/transition/route.ts", "utf8");
    expect(source).toContain("hashToken");
    expect(source).toContain("getPublicByTokenHash");
    expect(source).not.toContain("console.");
    expect(page).not.toContain("use client");
    expect(page).toContain("loadTicketByToken");
    expect(transition).toContain("requireStaff");
    expect(transition).toContain("staffTransition");
  });

  it("saves a reference and the matching category checklist when a booking is created", async () => {
    let saved: { id: string; dressCode: unknown } | null = null;
    const writer: BookingWriter = {
      consumeRateLimit: async () => true,
      loadContext: async () => ({
        officeSlug: "riverside",
        officeActive: true,
        serviceSlug: "conversion",
        serviceActive: true,
        requiresVehicle: false,
        category: categoryBySlug("foreign-conversion") ?? null,
      }),
      reserve: async (input) => {
        saved = { id: input.documentGuidance.id, dressCode: input.documentGuidance.dressCode };
        return { idempotent: false, id: booking.id, reference: "VD-TEST-BOOK", status: "confirmed" };
      },
      getPublicById: async () => booking,
    };
    const result = await createDemoBooking(
      writer,
      {
        officeId: booking.id,
        serviceId: "22222222-2222-4222-8222-222222222222",
        vehicleCategory: "",
        applicantDisplayName: "Sample Visitor",
        contactEmail: "",
        contactPhone: "",
        notes: "",
        timeSlotId: "33333333-3333-4333-8333-333333333333",
        acceptDisclaimer: true,
        idempotencyKey: "44444444-4444-4444-8444-444444444444",
        applicantCategory: "foreign",
        categorySlug: "foreign-conversion",
        answers: {
          issuingCountry: "japan",
          foreignLicenceClass: "motorcycle",
          foreignValid: "valid",
          foreignLanguage: "english",
        },
      },
      { keyHash: "ip", origin: "https://demo.example" },
    );
    expect(result.reference).toBe("VD-TEST-BOOK");
    expect(result.verificationUrl).toMatch(/^https:\/\/demo\.example\/demo-ticket\/[^/?#]+$/);
    expect(saved).toEqual({ id: "conversion-translation", dressCode: null });
  });
});
