"use client";

import { useI18n } from "@/components/language";
import type { DocumentSet, SavedGuidance } from "@/lib/booking/categories";
import { SAMPLE_GUIDANCE_NOTE } from "@/lib/demo-notice";

export function DocumentGuidance({ set }: { set: DocumentSet }) {
  const { locale, t } = useI18n();
  const title = locale === "th" ? set.titleTh : set.titleEn;
  return (
    <section className="space-y-3" data-testid="document-guidance">
      <h2 className="text-lg font-bold">{title}</h2>
      <p className="text-sm font-semibold text-brand-dark">{SAMPLE_GUIDANCE_NOTE}</p>
      <ol className="list-decimal space-y-3 pl-5 text-sm leading-6">
        {set.items.map((item, index) => {
          const validity = locale === "th" ? item.validityTh : item.validityEn;
          return (
            <li key={`${set.id}-${index}`}>
              <span className="font-semibold">{`${t.book.kinds[item.kind]}.`}</span> {locale === "th" ? item.th : item.en}
              {validity ? <span className="mt-1 block text-muted">{validity}</span> : null}
            </li>
          );
        })}
      </ol>
    </section>
  );
}

export function GuidancePanel({ guidance }: { guidance: SavedGuidance }) {
  const { locale } = useI18n();
  const dress = guidance.dressCode;
  const lines = dress ? (locale === "th" ? dress.itemsTh : dress.itemsEn) : [];
  return (
    <div className="space-y-6">
      <DocumentGuidance set={guidance} />
      {dress ? (
        <section aria-label={locale === "th" ? dress.titleTh : dress.titleEn}>
          <h3 className="text-lg font-bold">{locale === "th" ? dress.titleTh : dress.titleEn}</h3>
          <p className="mt-2 text-sm font-semibold leading-6 text-brand-dark">{locale === "th" ? dress.noteTh : dress.noteEn}</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm leading-6">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

export function BilingualGuidance({ guidance }: { guidance: SavedGuidance }) {
  return (
    <section data-testid="ticket-guidance">
      <h2 className="text-[17px] font-bold text-[#1a1a1a]">คำแนะนำ</h2>
      <p className="mt-3 text-[13px] leading-6 text-[#6d6d78]">{ticketGuidanceCopy(guidance)}</p>
    </section>
  );
}

function ticketGuidanceCopy(guidance: SavedGuidance) {
  const dress = guidance.dressCode;
  const numbered = guidance.items.map((item, index) => `${index + 1}. ${item.th}`).join(" ");
  const dressLine = dress ? `**${dress.titleTh} - ${dress.itemsTh.join(" - ")} ***${dress.noteTh}***` : "";
  return [dressLine, guidance.titleTh, "ต้องเตรียมเอกสารดังต่อไปนี้", numbered, "เอกสารที่ต้องใช้", numbered]
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}
