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
  const dress = guidance.dressCode;
  return (
    <div className="space-y-6" data-testid="ticket-guidance">
      <div>
        <h3 className="text-lg font-bold">{guidance.titleTh}</h3>
        <p className="text-sm text-muted">{guidance.titleEn}</p>
      </div>
      <p className="text-sm font-semibold leading-6 text-brand-dark">{SAMPLE_GUIDANCE_NOTE}</p>
      <ol className="list-decimal space-y-4 pl-5 text-sm leading-6">
        {guidance.items.map((item, index) => (
          <li key={`${guidance.id}-${index}`}>
            <span className="block">{item.th}</span>
            <span className="mt-1 block text-muted">{item.en}</span>
            {item.validityEn ? <span className="mt-1 block text-muted">{item.validityEn}</span> : null}
          </li>
        ))}
      </ol>
      {dress ? (
        <section aria-label={dress.titleEn}>
          <h3 className="text-lg font-bold">{dress.titleTh}</h3>
          <p className="text-sm text-muted">{dress.titleEn}</p>
          <p className="mt-2 text-sm font-semibold leading-6 text-brand-dark">{dress.noteEn}</p>
          <p className="mt-1 text-sm leading-6 text-muted">{dress.noteTh}</p>
          <ol className="mt-3 list-decimal space-y-3 pl-5 text-sm leading-6">
            {dress.itemsEn.map((line, index) => (
              <li key={line}>
                <span className="block">{dress.itemsTh[index] ?? line}</span>
                <span className="mt-1 block text-muted">{line}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
