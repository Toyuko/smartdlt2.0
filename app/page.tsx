"use client";

import Link from "next/link";
import { useI18n } from "@/components/language";
import { Button, Panel } from "@/components/ui";

export default function HomePage() {
  const { t } = useI18n();
  const actions = [
    { href: "/book", title: t.home.newAppointment, body: t.home.newAppointmentBody, testId: "start-booking", primary: true },
    { href: "/lookup", title: t.home.findBooking, body: t.home.findBookingBody, testId: "find-booking", primary: false },
    { href: "/services", title: t.home.guide, body: t.home.guideBody, testId: "service-guide", primary: false },
    { href: "/staff/login", title: t.home.staffPortal, body: t.home.staffPortalBody, testId: "staff-portal", primary: false },
  ];
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
      </section>
      <div className="grid gap-4 md:grid-cols-2">
        {actions.map((action) => (
          <Panel key={action.href}>
            <h2 className="text-xl font-bold">{action.title}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{action.body}</p>
            <div className="mt-4">
              <Link href={action.href}>
                <Button data-testid={action.testId} variant={action.primary ? "primary" : "secondary"}>
                  {action.title}
                </Button>
              </Link>
            </div>
          </Panel>
        ))}
      </div>
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
