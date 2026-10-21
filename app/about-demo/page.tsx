"use client";

import { useI18n } from "@/components/language";
import { Panel } from "@/components/ui";
import { SAMPLE_REFERENCES } from "@/lib/demo-catalog";

export default function AboutDemoPage() {
  const { t } = useI18n();
  const sections = [
    [t.about.scopeTitle, t.about.scope],
    [t.about.limitsTitle, t.about.limits],
    [t.about.privacyTitle, t.about.privacy],
    [t.about.retentionTitle, t.about.retention],
  ];
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-8">
      <h1 className="text-3xl font-bold">{t.about.title}</h1>
      {sections.map(([title, body]) => (
        <Panel key={title}>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-2 text-sm leading-6">{body}</p>
        </Panel>
      ))}
      <Panel>
        <h2 className="text-xl font-bold">{t.about.testingTitle}</h2>
        <p className="mt-2 text-sm leading-6">{t.about.testing}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm font-semibold">
          {Object.values(SAMPLE_REFERENCES).map((reference) => (
            <li key={reference}>{reference}</li>
          ))}
        </ul>
      </Panel>
    </main>
  );
}
