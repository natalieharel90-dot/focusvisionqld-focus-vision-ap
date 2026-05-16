// Fold the doctors roster into staff_users — step 2 of 3 (data backfill).
//
// Dry run (default) — read-only. Reports which doctors match an existing
// staff_users account by email and which would need a brand-new auth
// account. Makes no changes.
//   npx tsx --env-file=.env.local scripts/unify-doctors.ts
//
// Write run — requires SUPABASE_SERVICE_ROLE_KEY in the environment.
// Merges matched doctors into their staff_users row (only filling NULL
// fields), and for unmatched doctors creates an auth.users account via
// the Admin API plus a staff_users row flagged is_invited_only = true.
// Writes an audit trail to scripts/unify-doctors.log.
//   npx tsx --env-file=.env.local scripts/unify-doctors.ts --write
//
// Run order:  20260514120059 migration  →  this script  →  drop-doctors
// migration. Do NOT run --write before the 059 migration is applied
// (staff_users needs the new columns).

import { writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const WRITE = process.argv.includes("--write");

// A seeded staff account — used only for the read-only dry run when no
// service-role key is present. Staff RLS can read both tables.
const STAFF_EMAIL = "maria.chen@focusvision.dev";
const STAFF_PASSWORD = "seed-only-do-not-use";

type Doctor = {
  id: string;
  name: string;
  email: string | null;
  role: string;
  phone: string | null;
  photo_url: string | null;
  bio: string | null;
  welcome_video_url: string | null;
  active: boolean;
};
type Staff = { id: string; email: string; role: string; name: string };

async function getClient(): Promise<SupabaseClient> {
  if (!URL) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL — run with --env-file=.env.local");
    process.exit(1);
  }
  if (SERVICE) {
    return createClient(URL, SERVICE, { auth: { persistSession: false } });
  }
  if (WRITE) {
    console.error(
      "--write requires SUPABASE_SERVICE_ROLE_KEY in the environment " +
        "(needed for auth.admin.createUser and to bypass RLS)."
    );
    process.exit(1);
  }
  if (!ANON) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }
  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({
    email: STAFF_EMAIL,
    password: STAFF_PASSWORD,
  });
  if (error) {
    console.error("Dry-run staff sign-in failed:", error.message);
    process.exit(1);
  }
  return client;
}

async function main() {
  const supabase = await getClient();

  const { data: doctorsData, error: dErr } = await supabase
    .from("doctors")
    .select(
      "id, name, email, role, phone, photo_url, bio, welcome_video_url, active"
    );
  if (dErr) {
    console.error("Reading doctors failed:", dErr.message);
    process.exit(1);
  }
  const { data: staffData, error: sErr } = await supabase
    .from("staff_users")
    .select("id, email, role, name");
  if (sErr) {
    console.error("Reading staff_users failed:", sErr.message);
    process.exit(1);
  }

  const doctors = (doctorsData ?? []) as Doctor[];
  const staff = (staffData ?? []) as Staff[];
  const staffByEmail = new Map(
    staff.map((s) => [s.email.toLowerCase(), s] as const)
  );

  const matched: Array<{ doctor: Doctor; staff: Staff }> = [];
  const unmatched: Doctor[] = [];
  const noEmail: Doctor[] = [];
  for (const d of doctors) {
    if (!d.email) {
      noEmail.push(d);
      continue;
    }
    const m = staffByEmail.get(d.email.toLowerCase());
    if (m) matched.push({ doctor: d, staff: m });
    else unmatched.push(d);
  }

  console.log(`\n=== unify-doctors — ${WRITE ? "WRITE" : "DRY RUN"} ===`);
  console.log(`doctors: ${doctors.length}   staff_users: ${staff.length}`);

  console.log(`\nExisting staff_users accounts (${staff.length}):`);
  for (const s of staff) {
    console.log(`  ${s.name} <${s.email}>  role=${s.role}`);
  }

  console.log(`\nMatched — merge into existing account (${matched.length}):`);
  for (const { doctor, staff: s } of matched) {
    console.log(`  ${doctor.name} <${doctor.email}>  ->  staff_users ${s.id}`);
  }

  console.log(`\nUnmatched — new auth account required (${unmatched.length}):`);
  for (const d of unmatched) {
    console.log(`  ${d.name} <${d.email}>  role=${d.role}  active=${d.active}`);
  }

  if (noEmail.length > 0) {
    console.log(
      `\n⚠  Doctors with NO email (${noEmail.length}) — these CANNOT be ` +
        `migrated (staff_users.email is NOT NULL and an auth account needs ` +
        `an email). Add an email in Settings first:`
    );
    for (const d of noEmail) console.log(`  ${d.name}  role=${d.role}`);
  }

  if (!WRITE) {
    console.log(
      "\nDry run only — nothing was written. Re-run with --write " +
        "(and SUPABASE_SERVICE_ROLE_KEY set) to apply.\n"
    );
    return;
  }

  if (noEmail.length > 0) {
    console.error(
      "\nAborting --write: doctors without an email must be fixed first."
    );
    process.exit(1);
  }

  const log: string[] = [
    `unify-doctors write run @ ${new Date().toISOString()}`,
  ];

  // Merge matched doctors — fill only NULL fields, never overwrite.
  for (const { doctor, staff: s } of matched) {
    const { data: cur, error: curErr } = await supabase
      .from("staff_users")
      .select("display_name, photo_url, bio, welcome_video_url, phone")
      .eq("id", s.id)
      .single();
    if (curErr || !cur) {
      console.error(`Reading staff_users ${s.id} failed:`, curErr?.message);
      process.exit(1);
    }
    const patch: Record<string, unknown> = {};
    if (!cur.display_name) patch.display_name = doctor.name;
    if (!cur.photo_url) patch.photo_url = doctor.photo_url;
    if (!cur.bio) patch.bio = doctor.bio;
    if (!cur.welcome_video_url)
      patch.welcome_video_url = doctor.welcome_video_url;
    if (!cur.phone) patch.phone = doctor.phone;

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase
        .from("staff_users")
        .update(patch)
        .eq("id", s.id);
      if (error) {
        console.error(`Merging ${doctor.email} failed:`, error.message);
        process.exit(1);
      }
    }
    log.push(
      `merged ${doctor.email} -> staff_users ${s.id} ` +
        `[${Object.keys(patch).join(", ") || "no NULL fields to fill"}]`
    );
  }

  // Unmatched doctors — create an auth account, then the staff_users row.
  for (const d of unmatched) {
    const password = randomBytes(24).toString("base64url");
    const { data: created, error: cErr } = await supabase.auth.admin.createUser(
      { email: d.email!, password, email_confirm: true }
    );
    if (cErr || !created.user) {
      console.error(`createUser ${d.email} failed:`, cErr?.message);
      process.exit(1);
    }
    const uid = created.user.id;
    const { error: iErr } = await supabase.from("staff_users").insert({
      id: uid,
      email: d.email!,
      name: d.name,
      display_name: d.name,
      role: d.role.toLowerCase(),
      phone: d.phone,
      photo_url: d.photo_url,
      bio: d.bio,
      welcome_video_url: d.welcome_video_url,
      is_invited_only: true,
      active: d.active,
    });
    if (iErr) {
      console.error(`Inserting staff_users for ${d.email} failed:`, iErr.message);
      process.exit(1);
    }
    log.push(
      `created auth ${uid} + staff_users for ${d.email} ` +
        `(role=${d.role.toLowerCase()}, is_invited_only=true)`
    );
  }

  writeFileSync("scripts/unify-doctors.log", log.join("\n") + "\n");
  console.log(
    `\nDone. ${matched.length} merged, ${unmatched.length} created. ` +
      `Audit trail: scripts/unify-doctors.log\n`
  );
}

main();
