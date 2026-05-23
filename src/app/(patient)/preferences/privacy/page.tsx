import Link from "next/link";

export const dynamic = "force-static";

const SECTIONS: ReadonlyArray<{ heading: string; body: string }> = [
  {
    heading: "What we collect",
    body: "The Recovery Companion stores the information you give us during your recovery — daily check-ins, medication tracking, messages with your care team, and any feedback you leave.",
  },
  {
    heading: "How it's stored",
    body: "Your information is encrypted both at rest and in transit. All data is stored on servers located in Australia. We never store it overseas.",
  },
  {
    heading: "Who can see it",
    body: "Only you and your Focus Vision care team can see your information. It is never sold, never used for advertising, and never shared with third parties outside your care.",
  },
  {
    heading: "How long we keep it",
    body: "Clinical records are retained for the period required by Australian health law (currently seven years after your care ends). App preferences and non-clinical data are removed when you ask us to.",
  },
  {
    heading: "Your choices",
    body: "You can download a copy of everything you've shared, and you can request that your account be removed, at any time from the Settings screen.",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <main className="flex flex-col gap-4 px-5 py-6">
      <Link
        href="/preferences"
        className="text-sm font-semibold text-fv-text-secondary"
      >
        ‹ Settings
      </Link>

      <header>
        <h1 className="text-3xl font-bold text-fv-text-primary">
          Privacy policy
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          How Focus Vision handles your information
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {SECTIONS.map((s) => (
          <section
            key={s.heading}
            className="rounded-2xl bg-fv-bg-card p-5 shadow-sm"
          >
            <h2 className="font-semibold text-fv-text-primary">
              {s.heading}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-fv-text-secondary">
              {s.body}
            </p>
          </section>
        ))}
      </div>

      <p className="px-1 text-xs leading-relaxed text-fv-text-secondary">
        This is a plain-language summary. For the full privacy policy, or any
        questions about your information, contact your Focus Vision care team.
      </p>
    </main>
  );
}
