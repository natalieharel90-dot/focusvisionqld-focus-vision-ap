# Focus Vision — Recovery Companion

Post-operative care system for the Focus Vision refractive ophthalmology
clinic (Brisbane). One Next.js 14 codebase, two products:

- **Patient PWA** — `src/app/(patient)` — daily check-ins, medications,
  messaging, documents, pre-op info, feedback.
- **Staff dashboard** — `src/app/(dashboard)` — patient management, triage,
  analytics, bulk push, audit log, settings.

Backend is Supabase (Postgres + Auth + Realtime + Storage), Sydney region.
See `Focus_Vision_Recovery_Companion_Spec.docx` for the product spec and
`CLAUDE.md` for engineering conventions.

## Development

```bash
npm install
npm run dev          # dev server on http://localhost:3000
npm run typecheck    # tsc --noEmit
npm test             # vitest (pure-function unit tests, no DB)
npm run build        # production build
npm run gen:types    # regenerate src/types/database.types.ts from the remote DB
```

Environment variables live in `.env.local` (gitignored): the Supabase URL
and anon key.

## Database

Migrations are in `supabase/migrations/`, applied with `supabase db push`.

## Scripts

One-off scripts in `scripts/` (run with Node's `--env-file` so they pick up
`.env.local`):

```bash
# Seed sample patient documents (uploads PDFs as a staff user)
node --env-file=.env.local scripts/seed-documents.mjs

# Put a seed patient into the freshly-activated state (fires the onboarding tour)
node --env-file=.env.local scripts/activate-patient.mjs

# Verify row-level security — patient-A / patient-B / staff-data matrix
npx tsx --env-file=.env.local scripts/verify-rls.ts
```

### RLS verification

`scripts/verify-rls.ts` confirms patient row-level security holds: it signs
in as two seed patients and checks that each can read **their own** rows,
**cannot** read the other patient's rows, and **cannot** read staff-only
tables (`staff_notes`, `manual_flags`, `audit_events`, `bulk_pushes`,
`bulk_push_deliveries`). It exits non-zero if any RLS gap is found. This
lives as a script rather than a vitest test because it needs a live
database and real patient sessions — the vitest suite is DB-free.
