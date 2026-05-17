import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { createSupabaseServerClient } from "@/lib/supabase-server";
import { loadPatientFeatures } from "@/lib/patient-features-server";

export const dynamic = "force-dynamic";

// First letters of up to two name words, ignoring a leading "Dr".
function surgeonInitials(name: string): string {
  const words = name
    .trim()
    .replace(/^dr\.?\s+/i, "")
    .split(/\s+/)
    .filter(Boolean);
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export default async function SurgeonMessagePage() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/patient-sign-in");

  const features = await loadPatientFeatures(supabase, user.id);
  if (!features.surgeon_spotlight) redirect("/home");

  const { data: procedure } = await supabase
    .from("procedures")
    .select("surgeon_id")
    .eq("patient_id", user.id)
    .order("surgery_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!procedure?.surgeon_id) redirect("/home");

  const { data: surgeon } = await supabase
    .from("staff_users")
    .select("name, display_name, welcome_video_url, welcome_message")
    .eq("id", procedure.surgeon_id)
    .maybeSingle();
  if (!surgeon?.welcome_video_url) redirect("/home");

  const name = surgeon.display_name || surgeon.name;
  const videoUrl = surgeon.welcome_video_url;

  return (
    <main className="flex flex-col gap-5 px-5 py-6">
      <header>
        <h1 className="text-3xl font-bold leading-tight text-fv-text-primary">
          A message from your surgeon
        </h1>
        <p className="mt-1 text-sm text-fv-text-secondary">
          Recorded for your recovery journey
        </p>
      </header>

      <section className="rounded-3xl bg-gradient-to-b from-[#2a4e44] to-[#0e1714] px-6 py-7 text-center text-white">
        <div className="text-xs font-bold uppercase tracking-[0.2em] text-white/55">
          Personal welcome
        </div>

        {/* Avatar + play badge — opens the recorded video */}
        <a
          href={videoUrl}
          target="_blank"
          rel="noreferrer"
          className="relative mx-auto mt-5 block h-36 w-36"
        >
          <span className="grid h-36 w-36 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-700 text-4xl font-bold text-white shadow-lg">
            {surgeonInitials(name)}
          </span>
          <span className="absolute bottom-1 right-1 grid h-12 w-12 place-items-center rounded-full bg-white text-fv-accent-strong shadow">
            <PlayIcon />
          </span>
        </a>

        <div className="mt-4 text-xl font-bold">{name}</div>
        <div className="mt-0.5 text-sm text-white/60">
          Your surgeon · Focus Vision
        </div>

        {surgeon.welcome_message ? (
          <p className="mx-auto mt-5 max-w-sm text-[15px] italic leading-relaxed text-white/90">
            &ldquo;{surgeon.welcome_message}&rdquo;
          </p>
        ) : null}

        {/* Playback chrome — the video opens in the player on tap */}
        <div className="mt-6">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div className="h-full w-0 rounded-full bg-white" />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-white/55">
            <span>0:00</span>
            <span>0:00</span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-5">
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white/60">
            <SkipIcon dir="back" />
          </span>
          <a
            href={videoUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Play the welcome video"
            className="grid h-16 w-16 place-items-center rounded-full bg-white text-fv-accent-strong shadow-lg"
          >
            <PlayIcon big />
          </a>
          <span className="grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white/60">
            <SkipIcon dir="fwd" />
          </span>
        </div>
      </section>
    </main>
  );
}

function PlayIcon({ big = false }: { big?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={big ? "ml-0.5 h-7 w-7" : "ml-0.5 h-5 w-5"}
    >
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function SkipIcon({ dir }: { dir: "back" | "fwd" }): ReactNode {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`h-5 w-5 ${dir === "back" ? "rotate-180" : ""}`}
    >
      <path d="M5 5v14l8-7zM13 5v14l8-7z" />
    </svg>
  );
}
