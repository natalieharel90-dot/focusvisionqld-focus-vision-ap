// Patient name-split verification — confirms the first_name/last_name
// migration holds: the backfill left no unusable names, the generated
// `name` column equals trim(first_name + ' ' + last_name), and updating a
// part refreshes the generated column. Like verify-rls.ts this runs against
// the live database, so it lives here rather than in the DB-free vitest
// suite.
//
// Run:  npx tsx --env-file=.env.local scripts/verify-name-split.ts
//
// Exit code 0 = all checks passed, 1 = at least one check failed.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// A seeded staff account — staff RLS can read and update every patient.
const STAFF_EMAIL = "maria.chen@focusvision.dev";
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

const expectedName = (first: string, last: string): string =>
  `${first} ${last}`.trim();

async function main(): Promise<void> {
  console.log("Patient name-split verification\n");

  const client = createClient(URL as string, ANON as string);
  const { error: signInError } = await client.auth.signInWithPassword({
    email: STAFF_EMAIL,
    password: PASSWORD,
  });
  if (signInError) {
    console.error(`Staff sign-in failed: ${signInError.message}`);
    process.exit(1);
  }

  const { data: patients, error } = await client
    .from("patients")
    .select("id, first_name, last_name, name");
  if (error || !patients) {
    console.error(`Could not read patients: ${error?.message}`);
    process.exit(1);
  }
  check("patients are readable", patients.length > 0, `${patients.length} row(s)`);

  // 1. Backfill integrity — every row has a usable first name, and the
  //    generated name is never null.
  const missingFirst = patients.filter(
    (p) => !p.first_name || p.first_name.trim() === ""
  );
  check(
    "every patient has a first name",
    missingFirst.length === 0,
    `${missingFirst.length} missing`
  );

  // 2. Generated column equals first + ' ' + last for every row.
  const drifted = patients.filter(
    (p) => p.name !== expectedName(p.first_name, p.last_name)
  );
  check(
    "name === first_name + ' ' + last_name (all rows)",
    drifted.length === 0,
    drifted.length > 0
      ? `e.g. "${drifted[0]!.name}" vs parts`
      : `checked ${patients.length}`
  );

  // 3. Updating a part refreshes the generated name. Mutate one row, verify,
  //    then revert so the seed data is left untouched.
  const subject = patients[0]!;
  const probe = `${subject.first_name}_zzcheck`;
  await client
    .from("patients")
    .update({ first_name: probe })
    .eq("id", subject.id);
  const { data: updated } = await client
    .from("patients")
    .select("name")
    .eq("id", subject.id)
    .single();
  check(
    "updating first_name refreshes generated name",
    updated?.name === expectedName(probe, subject.last_name),
    `got "${updated?.name}"`
  );
  // Revert.
  await client
    .from("patients")
    .update({ first_name: subject.first_name })
    .eq("id", subject.id);
  const { data: reverted } = await client
    .from("patients")
    .select("name")
    .eq("id", subject.id)
    .single();
  check(
    "probe row reverted cleanly",
    reverted?.name === expectedName(subject.first_name, subject.last_name)
  );

  console.log(
    `\n${
      failures === 0
        ? "✓ All name-split checks passed."
        : `✗ ${failures} check(s) FAILED.`
    }`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
