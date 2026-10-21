"use client";

import { useEffect, useRef } from "react";
import { useI18n } from "@/components/language";
import { Button } from "@/components/ui";
import { DEMO_QR_NOTICE, DEMO_QR_NOTICE_TH } from "@/lib/demo-notice";

export function QrCard({ verificationUrl, reference }: { verificationUrl: string; reference: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    let cancel = false;
    async function draw() {
      const QRCode = (await import("qrcode")).default;
      const source = document.createElement("canvas");
      await QRCode.toCanvas(source, verificationUrl, { width: 280, margin: 1, errorCorrectionLevel: "M" });
      const canvas = canvasRef.current;
      if (!canvas || cancel) return;
      canvas.width = 320;
      canvas.height = 390;
      const context = canvas.getContext("2d");
      if (!context) return;
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 20, 12);
      context.fillStyle = "#3d188c";
      context.textAlign = "center";
      context.font = "700 13px sans-serif";
      wrapText(context, DEMO_QR_NOTICE, 160, 314, 290, 16);
      context.font = "12px sans-serif";
      context.fillText(reference, 160, 372);
    }
    void draw();
    return () => {
      cancel = true;
    };
  }, [reference, verificationUrl]);

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-xs font-semibold uppercase tracking-wide text-muted">{t.confirm.scan}</p>
      <canvas ref={canvasRef} role="img" aria-label={`${DEMO_QR_NOTICE} ${reference}`} className="h-auto max-w-full rounded-2xl border border-line" />
      <p className="max-w-xs text-center text-sm font-bold text-brand-dark">{DEMO_QR_NOTICE}</p>
      <p className="max-w-xs text-center text-sm text-muted">{DEMO_QR_NOTICE_TH}</p>
      <Button
        type="button"
        variant="secondary"
        className="no-print"
        onClick={() => {
          const link = document.createElement("a");
          link.href = canvasRef.current?.toDataURL("image/png") ?? "";
          link.download = `smartdlt2.0-${reference}.png`;
          link.click();
        }}
      >
        {t.actions.saveQr}
      </Button>
    </div>
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
