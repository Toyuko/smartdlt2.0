import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => cleanup());
import { MonthCalendar } from "@/components/booking/month-calendar";
import { AppProviders } from "@/components/language";
import { DEMO_NOTICE } from "@/lib/demo-notice";

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
});
