"use client";

import { useI18n } from "@/components/language";
import type { DocumentSet } from "@/lib/booking/categories";
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
