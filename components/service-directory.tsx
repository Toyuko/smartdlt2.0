"use client";

import { useEffect, useState } from "react";
import { DocumentGuidance } from "@/components/booking/document-guidance";
import { errorText, SetupRequired, useI18n } from "@/components/language";
import { Panel } from "@/components/ui";
import { selectDocumentSet, type BookingCategory } from "@/lib/booking/categories";
import type { CatalogOffice, CatalogService } from "@/lib/data/store";

export function ServiceDirectory() {
  const { locale, t } = useI18n();
  const [services, setServices] = useState<CatalogService[]>([]);
  const [offices, setOffices] = useState<CatalogOffice[]>([]);
  const [categories, setCategories] = useState<BookingCategory[]>([]);
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
        setServices(body.services ?? []);
        setOffices(body.offices ?? []);
        setCategories(body.categories ?? []);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">{t.services.title}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">{t.services.intro}</p>
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
        {categories.map((category) => {
          const related = services.filter((service) => service.category === category.slug);
          const guidance = selectDocumentSet(category, {
            applicantCategory: "",
            serviceSlug: "",
            licenceClass: "",
            licenceType: "",
          });
          return (
            <Panel key={category.slug}>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand">{locale === "th" ? category.nameTh : category.name}</p>
              <p className="mt-2 text-sm leading-6 text-muted">{locale === "th" ? category.descriptionTh : category.description}</p>
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
                {related.map((service) => (
                  <li key={service.id}>{locale === "th" ? service.nameTh : service.name}</li>
                ))}
              </ul>
              <div className="mt-4">
                <DocumentGuidance set={guidance} />
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
