import Link from "next/link";

export const dynamic = "force-dynamic";

const SECTIONS: ReadonlyArray<{
  href: string;
  title: string;
  description: string;
}> = [
  {
    href: "/settings/alert-thresholds",
    title: "Alert thresholds",
    description:
      "Per-(procedure × surgeon) routing rules for pain, light sensitivity, vision, and each symptom chip.",
  },
  {
    href: "/settings/alert-actions",
    title: "Alert actions",
    description:
      "What happens at each alert level (Yellow / Orange / Red) — email, in-app, on-call push, SMS, auto-call.",
  },
  {
    href: "/settings/symptoms",
    title: "Standard symptom options",
    description:
      "The chip set the patient sees on the daily check-in. Adding a new symptom auto-creates an Orange routing rule.",
  },
];

export default function SettingsIndexPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="pb-6 text-2xl font-semibold text-fv-text-primary">
        Settings
      </h1>
      <ul className="space-y-3">
        {SECTIONS.map((s) => (
          <li key={s.href}>
            <Link
              href={s.href}
              className="block rounded-xl bg-fv-bg-card p-5 shadow-sm hover:shadow"
            >
              <div className="text-base font-semibold text-fv-text-primary">
                {s.title}
              </div>
              <div className="mt-1 text-sm text-fv-text-secondary">
                {s.description}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
