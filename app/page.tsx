"use client";

import Link from "next/link";
import { useI18n } from "@/components/language";
import { Button, Panel } from "@/components/ui";

export default function HomePage() {
  const { t } = useI18n();
  const cards = [
    [t.home.card1Title, t.home.card1Body],
    [t.home.card2Title, t.home.card2Body],
    [t.home.card3Title, t.home.card3Body],
  ];
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <section className="max-w-3xl">
        <p className="text-sm font-bold uppercase tracking-wide text-brand">{t.tagline}</p>
        <h1 className="mt-2 text-4xl font-bold leading-tight sm:text-5xl">{t.home.title}</h1>
        <p className="mt-4 text-lg leading-8 text-muted">{t.home.lede}</p>
        <div className="mt-6">
          <Link href="/book">
            <Button data-testid="start-booking">{t.actions.start}</Button>
          </Link>
        </div>
      </section>
      <div className="grid gap-4 md:grid-cols-3">
        {cards.map(([title, body]) => (
          <Panel key={title}>
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
          </Panel>
        ))}
      </div>
    </main>
  );
}
