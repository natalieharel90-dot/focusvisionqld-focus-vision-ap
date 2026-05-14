import { createSupabaseClient } from "@/lib/supabase";

// Force runtime rendering so missing env vars surface as a clear error
// on this page rather than failing the production build.
export const dynamic = "force-dynamic";

type ProbeResult =
  | { ok: true; detail: string }
  | { ok: false; detail: string };

async function probeConnection(): Promise<ProbeResult> {
  let supabase;
  try {
    supabase = createSupabaseClient();
  } catch (err) {
    return {
      ok: false,
      detail: err instanceof Error ? err.message : "Unknown setup error",
    };
  }

  // Query a deliberately non-existent table. PostgREST responds with a
  // "table not found" error (PGRST205 in the schema cache, or 42P01 from
  // Postgres directly) — that response proves the URL is reachable and the
  // anon key is accepted. Network and auth failures surface differently.
  const probeTable = "_connection_probe" as never;
  const { error } = await supabase.from(probeTable).select("*").limit(0);

  if (!error) {
    return {
      ok: true,
      detail:
        "Connected. (Unexpected: probe table exists — that is fine, connection is working.)",
    };
  }
  const tableMissingCodes = new Set(["PGRST205", "PGRST204", "42P01"]);
  if (error.code && tableMissingCodes.has(error.code)) {
    return {
      ok: true,
      detail: `Connected. PostgREST responded "${error.message}" (code ${error.code}) — expected, since no tables have been migrated yet.`,
    };
  }
  return {
    ok: false,
    detail: `${error.code ?? "unknown"} — ${error.message}`,
  };
}

export default async function TestSupabasePage() {
  const result = await probeConnection();
  const urlIsSet = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const keyIsSet = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-6 py-16">
      <h1 className="text-2xl font-semibold text-fv-text-primary">
        Supabase connection test
      </h1>

      <section className="rounded-xl bg-fv-bg-card p-5 shadow-sm">
        <h2 className="text-sm font-bold uppercase tracking-wide text-fv-text-secondary">
          Environment
        </h2>
        <ul className="mt-3 space-y-1 text-sm">
          <li>
            <code>NEXT_PUBLIC_SUPABASE_URL</code>:{" "}
            <span className={urlIsSet ? "text-fv-accent-strong" : "text-red-600"}>
              {urlIsSet ? "set" : "missing"}
            </span>
          </li>
          <li>
            <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>:{" "}
            <span className={keyIsSet ? "text-fv-accent-strong" : "text-red-600"}>
              {keyIsSet ? "set" : "missing"}
            </span>
          </li>
        </ul>
      </section>

      <section
        className={`rounded-xl p-5 shadow-sm ${
          result.ok ? "bg-fv-bg-card" : "bg-red-50"
        }`}
      >
        <h2 className="text-sm font-bold uppercase tracking-wide text-fv-text-secondary">
          Connection probe
        </h2>
        <p
          className={`mt-3 text-base font-semibold ${
            result.ok ? "text-fv-accent-strong" : "text-red-700"
          }`}
        >
          {result.ok ? "Connected" : "Failed"}
        </p>
        <p className="mt-2 text-sm text-fv-text-primary">{result.detail}</p>
      </section>
    </main>
  );
}
