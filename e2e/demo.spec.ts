import { expect, test } from "@playwright/test";

const notice =
  "DEMONSTRATION SYSTEM — NOT AN OFFICIAL DLT SERVICE. Appointments and QR codes are for demonstration and testing only and are not valid for government services.";

test("landing page explains the demo and starts booking", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("demo-banner")).toContainText(notice);
  await page.getByTestId("start-booking").click();
  await expect(page).toHaveURL(/\/book/);
  await expect(page.getByRole("heading", { name: "Book a demonstration appointment" })).toBeVisible();
});

test("about page lists scope and sample references", async ({ page }) => {
  await page.goto("/about-demo");
  await expect(page.getByRole("heading", { name: "About this demonstration" })).toBeVisible();
  await expect(page.getByText("VD-SAMP-CONF")).toBeVisible();
  await expect(page.getByTestId("demo-banner")).toContainText(notice);
});

test("language switch and mobile banner stay available", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("demo-banner")).toBeVisible();
  await page.getByRole("button", { name: "ไทย" }).click();
  await expect(page.getByRole("heading", { name: "ฝึกใช้โต๊ะนัดหมายโดยไม่เข้าสู่ระบบของหน่วยงานราชการ" })).toBeVisible();
});

test("lookup rejects a malformed reference without creating data", async ({ page }) => {
  await page.goto("/lookup");
  await page.getByLabel("Booking reference").fill("not-a-reference");
  await page.getByRole("button", { name: "Find booking" }).click();
  await expect(page.getByText("Enter a reference in the form VD-XXXX-XXXX.")).toBeVisible();
});

test("staff summary is not public", async ({ request }) => {
  const response = await request.get("/api/staff/summary");
  expect([401, 403, 503]).toContain(response.status());
});

test("staff sign-in page is reachable and does not ask for a government credential", async ({ page }) => {
  await page.goto("/staff/login");
  await expect(page.getByRole("heading", { name: "Staff sign in" })).toBeVisible();
  await expect(page.getByTestId("demo-banner")).toContainText(notice);
  await expect(page.getByLabel("Email")).toBeVisible();
});
