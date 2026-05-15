// RLS verification — confirms patient row-level security holds across the
// patient-A / patient-B / staff-data matrix. This runs against the live
// database with real seed-patient sessions, so it lives here as a
// runnable script rather than in the (DB-free) vitest suite.
//
// Run:  npx tsx --env-file=.env.local scripts/verify-rls.ts
//
// Exit code 0 = all checks passed, 1 = at least one RLS gap detected.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const PASSWORD = "seed-only-do-not-use";

if (!URL || !ANON) {
  console.error("Missing Supabase env. Run with --env-file=.env.local");
  process.exit(1);
}

let failures = 0;
function check(name: string, passed: boolean, detail = ""): void {
  console.log(
    `${passed ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`
  );
  if (!passed) failures += 1;
}

// An untyped client — we're probing RLS with dynamic table names.
async function signIn(email: string): Promise<{
  client: SupabaseClient;
  id: string;
}> {
  const client = createClient(URL as string, ANON as string);
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) {
    console.error(`Sign-in failed for ${email}: ${error.message}`);
    process.exit(1);
  }
  const {
    data: { user },
  } = await client.auth.getUser();
  return { client, id: user?.id ?? "" };
}

// Patient-owned tables that carry a patient_id column.
const PATIENT_TABLES = [
  "procedures",
  "medications",
  "check_ins",
  "appointments",
  "documents",
  "message_threads",
  "feedback",
  "patient_feature_flags",
  "patient_setup_tasks",
  "eye_photos",
];

// Tables that carry a patient_id but are deliberately staff-only.
const STAFF_ONLY_TABLES = [
  "staff_notes",
  "manual_flags",
  "audit_events",
  "bulk_pushes",
  "bulk_push_deliveries",
];

async function rowCount(
  client: SupabaseClient,
  table: string,
  column: string,
  value?: string
): Promise<number> {
  let query = client.from(table).select(column);
  if (value !== undefined) query = query.eq(column, value);
  const { data } = await query;
  return data?.length ?? 0;
}

async function main(): Promise<void> {
  console.log("RLS verification — patient-A / patient-B / staff matrix\n");
  const a = await signIn("patient.one@example.dev");
  const b = await signIn("patient.two@example.dev");

  // 1. A reads their own patient row.
  check(
    "A reads own patients row",
    (await rowCount(a.client, "patients", "id", a.id)) === 1
  );
  // 2. A cannot read B's patient row.
  check(
    "A cannot read B's patients row",
    (await rowCount(a.client, "patients", "id", b.id)) === 0
  );

  // 3. Patient-owned tables — A sees only their own rows, never B's.
  for (const table of PATIENT_TABLES) {
    const { data: own } = await a.client.from(table).select("patient_id");
    const ownRows = (own ?? []) as { patient_id: string }[];
    check(
      `A reads own ${table}`,
      ownRows.every((r) => r.patient_id === a.id),
      `${ownRows.length} row(s), all A's`
    );
    check(
      `A cannot read B's ${table}`,
      (await rowCount(a.client, table, "patient_id", b.id)) === 0
    );
  }

  // 4. Staff-only tables — a patient sees zero rows.
  for (const table of STAFF_ONLY_TABLES) {
    const { data } = await a.client.from(table).select("id");
    check(`A cannot read staff-only ${table}`, (data?.length ?? 0) === 0);
  }

  // 5. Symmetric spot-check — B cannot read A's data either.
  check(
    "B cannot read A's check_ins (symmetric)",
    (await rowCount(b.client, "check_ins", "patient_id", a.id)) === 0
  );
  check(
    "B cannot read A's documents (symmetric)",
    (await rowCount(b.client, "documents", "patient_id", a.id)) === 0
  );

  console.log(
    `\n${
      failures === 0
        ? "✓ All RLS checks passed."
        : `✗ ${failures} RLS check(s) FAILED.`
    }`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
