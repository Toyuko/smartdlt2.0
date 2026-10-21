"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/language";
import { Button } from "@/components/ui";
import { DEMO_QR_CODE_WARNING, DEMO_QR_NOTICE_TH } from "@/lib/demo-notice";

export function QrCard({
  verificationUrl,
  reference,
  imageSrc,
  heading,
}: {
  verificationUrl: string;
  reference: string;
  imageSrc?: string;
  heading?: string;
}) {
  const { t } = useI18n();
  const [generated, setGenerated] = useState("");

  useEffect(() => {
    if (imageSrc) return;
    let cancel = false;
    void import("qrcode").then(async (mod) => {
      const url = await mod.default.toDataURL(verificationUrl, {
        errorCorrectionLevel: "H",
        margin: 2,
        width: 320,
        color: { dark: "#1d1630", light: "#ffffff" },
      });
      if (!cancel) setGenerated(url);
    });
    return () => {
      cancel = true;
    };
  }, [imageSrc, verificationUrl]);

  const src = imageSrc || generated;

  async function save() {
    const QRCode = (await import("qrcode")).default;
    const source = document.createElement("canvas");
    await QRCode.toCanvas(source, verificationUrl, { width: 280, margin: 2, errorCorrectionLevel: "H" });
    const canvas = document.createElement("canvas");
    canvas.width = 360;
    canvas.height = 440;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 40, 16);
    context.fillStyle = "#3d188c";
    context.textAlign = "center";
    context.font = "700 16px sans-serif";
    context.fillText(reference, 180, 328);
    context.font = "700 12px sans-serif";
    wrapText(context, DEMO_QR_CODE_WARNING, 180, 356, 320, 16);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `smartdlt2.0-${reference}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {heading ? <h2 className="text-center text-base font-bold text-ink">{heading}</h2> : null}
      <figure data-testid="qr-print" data-qr-payload={verificationUrl} className="qr-print flex flex-col items-center gap-3">
        {src ? (
          <img
            src={src}
            alt={`${DEMO_QR_CODE_WARNING} ${reference}`}
            width={256}
            height={256}
            className="h-auto w-64 max-w-full"
          />
        ) : (
          <div className="grid h-64 w-64 max-w-full place-items-center rounded-2xl bg-mist text-sm text-muted" role="img" aria-label={`${DEMO_QR_CODE_WARNING} ${reference}`}>
            {t.book.submitting}
          </div>
        )}
        <figcaption className="break-all text-center text-base font-bold tracking-wide text-brand-dark">{reference}</figcaption>
      </figure>
      <p data-testid="qr-warning" className="max-w-sm text-center text-sm font-bold leading-6 text-brand-dark">
        {DEMO_QR_CODE_WARNING}
      </p>
      <p className="max-w-sm text-center text-sm leading-6 text-muted">{DEMO_QR_NOTICE_TH}</p>
      <div className="no-print flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Button type="button" className="w-full sm:w-auto" onClick={() => void save()}>
          <DownloadIcon />
          {t.actions.saveQr}
        </Button>
        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => window.print()}>
          {t.actions.print}
        </Button>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="mr-2 h-5 w-5 fill-none stroke-current" strokeWidth="2">
      <path d="M12 4v10" strokeLinecap="round" />
      <path d="M8 10l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 19h14" strokeLinecap="round" />
    </svg>
  );
}

function wrapText(context: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
  const words = text.split(" ");
  let line = "";
  let cursor = y;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) {
      context.fillText(line, x, cursor);
      line = word;
      cursor += lineHeight;
    } else {
      line = next;
    }
  }
  if (line) context.fillText(line, x, cursor);
}
