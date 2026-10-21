// @vitest-environment node
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { buildVerificationUrl } from "@/lib/booking/codes";

describe("demo ticket QR image", () => {
  it("writes a PNG whose payload is the public demo-ticket URL", async () => {
    const token = "a".repeat(43);
    const url = buildVerificationUrl("https://demo.example", token);
    const png = await QRCode.toBuffer(url, { errorCorrectionLevel: "H", margin: 2, width: 320 });
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png.length).toBeGreaterThan(500);
    const segment = QRCode.create(url).segments[0];
    const encoded = Buffer.from(segment.data).toString("utf8");
    expect(encoded).toContain("demo-ticket/");
    expect(encoded).toContain(token);
    expect(url).toBe(`https://demo.example/demo-ticket/${token}`);
  });
});
