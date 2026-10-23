"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, Suspense, useContext, useEffect, useState, type ReactNode } from "react";
import { DEMO_NOTICE, DEMO_NOTICE_TH } from "@/lib/demo-notice";
import { en, th, type Dictionary } from "@/lib/i18n/dictionary";

type Locale = "en" | "th";

const I18nContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Dictionary;
}>({ locale: "en", setLocale: () => undefined, t: en });

export function useI18n() {
  return useContext(I18nContext);
}

export function errorText(errors: Dictionary["errors"], code: string | undefined) {
  if (!code) return "";
  return code in errors ? errors[code as keyof Dictionary["errors"]] : errors.server_error;
}

export function AppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";
  const immersive = pathname.startsWith("/booking-confirmation") || pathname.startsWith("/demo-ticket");
  const [locale, setLocaleState] = useState<Locale>("en");

  useEffect(() => {
    const saved = window.localStorage.getItem("vd-locale");
    if (saved === "th" || saved === "en") {
      // Apply the saved language after hydration so the server HTML stays English.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocaleState(saved);
    }
  }, []);

  function setLocale(next: Locale) {
    setLocaleState(next);
    window.localStorage.setItem("vd-locale", next);
    document.documentElement.lang = next;
  }

  const t = locale === "th" ? th : en;

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      <div className="flex min-h-full flex-col">
        <a href="#content" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-white focus:px-3 focus:py-2">
          Skip to content
        </a>
        <div className={immersive ? "max-lg:hidden" : undefined}>
          <DemoBanner />
          <Suspense fallback={<div className="h-16 border-b border-line bg-white" />}>
            <SiteHeader />
          </Suspense>
        </div>
        <div id="content" className="flex-1">
          {children}
        </div>
        <footer className={`no-print border-t border-line px-4 py-6 text-center text-sm text-muted ${immersive ? "max-lg:hidden" : ""}`}>{t.footer}</footer>
      </div>
    </I18nContext.Provider>
  );
}

export function DemoBanner() {
  const { locale } = useI18n();
  return (
    <div data-testid="demo-banner" className="bg-brand-dark px-4 py-2 text-center text-xs font-semibold leading-5 text-white sm:text-sm">
      <p>{DEMO_NOTICE}</p>
      {locale === "th" ? <p className="mt-1 font-medium text-white/90">{DEMO_NOTICE_TH}</p> : null}
    </div>
  );
}

function SiteHeader() {
  const { t, locale, setLocale } = useI18n();
  const pathname = usePathname();
  const links = [
    ["/", t.nav.home],
    ["/book", t.nav.book],
    ["/services", t.nav.services],
    ["/lookup", t.nav.lookup],
    ["/about-demo", t.nav.about],
    ["/staff/dashboard", t.nav.staff],
  ] as const;

  return (
    <header className="no-print border-b border-line bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-2xl bg-brand text-lg font-bold text-white" aria-hidden>
            S
          </span>
          <span>
            <span className="block text-base font-bold leading-5">{t.brand}</span>
            <span className="block text-xs text-muted">{t.tagline}</span>
          </span>
        </Link>
        <nav className="flex flex-wrap items-center gap-1" aria-label="Primary">
          {links.map(([href, label]) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`rounded-full px-3 py-2 text-sm font-semibold ${active ? "bg-brand-soft text-brand-dark" : "text-ink hover:bg-paper"}`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex rounded-full bg-paper p-1" role="group" aria-label="Language">
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${locale === "en" ? "bg-white text-brand-dark shadow-sm" : "text-muted"}`}
            aria-pressed={locale === "en"}
            onClick={() => setLocale("en")}
          >
            English
          </button>
          <button
            type="button"
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${locale === "th" ? "bg-white text-brand-dark shadow-sm" : "text-muted"}`}
            aria-pressed={locale === "th"}
            onClick={() => setLocale("th")}
          >
            ไทย
          </button>
        </div>
      </div>
    </header>
  );
}

export function SetupRequired() {
  const { t } = useI18n();
  return (
    <div className="rounded-3xl border border-dashed border-brand bg-brand-soft p-6" role="status">
      <h2 className="text-xl font-bold">{t.setup.title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{t.setup.body}</p>
    </div>
  );
}
