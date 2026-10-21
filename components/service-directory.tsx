"use client";

import { useEffect, useState } from "react";
import { errorText, SetupRequired, useI18n } from "@/components/language";
import { Panel } from "@/components/ui";
import { SAMPLE_GUIDANCE_NOTE } from "@/lib/demo-notice";
import type { CatalogOffice, CatalogService } from "@/lib/data/store";

export function ServiceDirectory() {
  const { locale, t } = useI18n();
  const [services, setServices] = useState<CatalogService[]>([]);
  const [offices, setOffices] = useState<CatalogOffice[]>([]);
  const [setup, setSetup] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/catalog")
      .then(async (response) => {
        const body = await response.json();
        if (response.status === 503) {
          setSetup(true);
          return;
        }
        if (!response.ok) throw new Error(body.error ?? "catalog_unavailable");
        setServices(body.services);
        setOffices(body.offices);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t.services.title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{t.services.intro}</p>
        <p className="mt-3 text-sm font-semibold text-brand-dark">{SAMPLE_GUIDANCE_NOTE}</p>
      </div>
      {setup ? <SetupRequired /> : null}
      {error ? <p role="alert">{errorText(t.errors, error)}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        {offices.map((office) => (
          <Panel key={office.id}>
            <h2 className="text-lg font-bold">{locale === "th" ? office.nameTh : office.name}</h2>
            <p className="text-sm text-muted">{locale === "th" ? office.provinceTh : office.province}</p>
            <p className="mt-2 text-sm font-semibold">{office.demoLabel}</p>
          </Panel>
        ))}
      </div>
      <div className="grid gap-4">
        {services.map((service) => (
          <Panel key={service.id}>
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">{locale === "th" ? service.categoryTh : service.category}</p>
            <h2 className="mt-1 text-xl font-bold">{locale === "th" ? service.nameTh : service.name}</h2>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-sm leading-6">
              {service.documentGuidance.items.map((item) => (
                <li key={item.en}>{locale === "th" ? item.th : item.en}</li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>
    </div>
  );
}
