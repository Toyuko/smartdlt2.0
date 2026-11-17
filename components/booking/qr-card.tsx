"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/language";
import { Button } from "@/components/ui";
import { th } from "@/lib/i18n/dictionary";

export function QrCard({
  verificationUrl,
  reference,
  imageSrc,
  heading,
  layout = "full",
}: {
  verificationUrl: string;
  reference: string;
  imageSrc?: string;
  heading?: string;
  layout?: "full" | "slip" | "ticket";
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
        color: { dark: "#111111", light: "#ffffff" },
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
    canvas.height = 360;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 40, 16);
    context.fillStyle = "#3d188c";
    context.textAlign = "center";
    context.font = "700 16px sans-serif";
    context.fillText(reference, 180, 328);
    const link = document.createElement("a");
    link.href = canvas.toDataURL("image/png");
    link.download = `smartdlt2.0-${reference}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  if (layout === "ticket") {
    return (
      <figure data-testid="qr-print" data-qr-payload={verificationUrl} className="qr-print flex w-full justify-center">
        {src ? (
          <img src={src} alt={reference} width={256} height={256} className="h-auto w-64 max-w-full" />
        ) : (
          <QrPlaceholder reference={reference} label={th.book.submitting} />
        )}
      </figure>
    );
  }

  if (layout === "slip") {
    return (
      <figure data-testid="qr-print" data-qr-payload={verificationUrl} className="qr-print mt-2 flex w-full flex-col items-center">
        <div className="relative w-full">
          {src ? (
            <img src={src} alt={reference} width={208} height={208} className="mx-auto h-auto w-52 max-w-[70%]" />
          ) : (
            <QrPlaceholder reference={reference} label={t.book.submitting} compact />
          )}
          <div className="no-print absolute top-1/2 right-0 -translate-y-1/2">
            <button
              type="button"
              aria-label={t.actions.saveQr}
              onClick={() => void save()}
              className="grid h-11 w-11 place-items-center rounded-full bg-[#f2f2f4] text-[#8d8d96] shadow-[0_2px_8px_rgba(20,20,40,0.08)]"
            >
              <DownloadIcon className="h-5 w-5" />
            </button>
            <button type="button" className="sr-only" onClick={() => window.print()}>
              {t.actions.print}
            </button>
          </div>
        </div>
        <figcaption className="mt-2 break-all text-center text-[15px] font-semibold tracking-wide text-[#1c1c1c]">{reference}</figcaption>
      </figure>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      {heading ? <h2 className="text-center text-base font-bold text-ink">{heading}</h2> : null}
      <figure data-testid="qr-print" data-qr-payload={verificationUrl} className="qr-print flex flex-col items-center gap-3">
        {src ? (
          <img
            src={src}
            alt={reference}
            width={256}
            height={256}
            className="h-auto w-64 max-w-full"
          />
        ) : (
          <QrPlaceholder reference={reference} label={t.book.submitting} />
        )}
        <figcaption className="break-all text-center text-base font-bold tracking-wide text-brand-dark">{reference}</figcaption>
      </figure>
      <div className="no-print flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Button type="button" className="w-full sm:w-auto" onClick={() => void save()}>
          <DownloadIcon className="mr-2 h-5 w-5" />
          {t.actions.saveQr}
        </Button>
        <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={() => window.print()}>
          {t.actions.print}
        </Button>
      </div>
    </div>
  );
}

function QrPlaceholder({ reference, label, compact = false }: { reference: string; label: string; compact?: boolean }) {
  return (
    <div
      className={compact ? "mx-auto grid h-52 w-52 max-w-[70%] place-items-center rounded-2xl bg-mist text-sm text-muted" : "grid h-64 w-64 max-w-full place-items-center rounded-2xl bg-mist text-sm text-muted"}
      role="img"
      aria-label={reference}
    >
      {label}
    </div>
  );
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={`${className ?? ""} fill-none stroke-current`} strokeWidth="1.8">
      <path d="M12 4v9" strokeLinecap="round" />
      <path d="m8.2 10.2 3.8 3.8 3.8-3.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M6 17.5h12" strokeLinecap="round" />
      <path d="M7.5 17.5V19a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-1.5" strokeLinecap="round" />
    </svg>
  );
}
