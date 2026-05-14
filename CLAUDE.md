# Focus Vision — Recovery Companion

This is the context file Claude Code reads at the start of every session. Keep it under ~300 lines so it stays useful as a system prompt.

## What this project is

The Recovery Companion is a post-operative care system for **Focus Vision**, a refractive ophthalmology clinic in Brisbane, Australia. It has two coordinated products that share a single backend and codebase:

1. **Patient app** — a calm, easy-to-use mobile companion that helps patients track medications, complete daily check-ins, watch educational videos, store surgical documents, and message the clinic. Surfaces a Day-X recovery progress indicator and adapts content based on procedure and surgeon.

2. **Staff dashboard** — a web app where clinical staff manage patients, monitor recoveries, configure routing rules, message patients, and run the clinic. Includes the patient list, triage queue, messaging inbox, analytics, audit log, Procedures library, and Settings.

The full product specification is in **`Focus_Vision_Recovery_Companion_Spec.docx`** — read it before doing anything substantive. It's the source of truth. The visual prototype is in **`focus_vision_prototype.html`** — open it in a browser to see what the product should look and feel like. Both files live alongside this one in the project root.

## Tech stack — stick to this

- **Next.js 14** (App Router) with **TypeScript strict mode** — both the staff dashboard and the patient app are Next.js routes in the same project (different route groups, different layouts)
- **Tailwind CSS** for styling — match the prototype's visual language (themes, colours, spacing)
- **Supabase** for auth, Postgres database, Realtime (messaging), and Storage (documents/photos). Project is in the **Sydney (ap-southeast-2)** region for Australian data residency.
- **Vercel** for hosting (free tier; auto-deploys on git push)
- **Zod** for runtime validation at every API boundary
- Patient "app" is delivered as a **Progressive Web App (PWA)** initially — installable from a web link via "Add to Home Screen". Native iOS/Android comes later (Phase 7 — handled by a contractor).

DO NOT introduce other frameworks (Vue, Svelte, Remix, etc.) or other backends (Firebase, Hasura, AWS Amplify, etc.) — we want to keep this simple and focused. DO NOT add third-party analytics SDKs.

## Data model (section 7 of the spec is the source of truth)

Implement these as Postgres tables via Supabase migrations. UUIDs for primary keys. Every table gets `created_at` and `updated_at`. Every staff write triggers an `audit_events` row.

Core tables (start with these):

- `patients`, `procedures`, `procedure_templates`
- `medications`, `medication_doses` — `medications` uses soft-delete (`stopped_at`, `stopped_by_staff_id`, `stop_reason`) so the clinical record is preserved
- `check_ins` — stores both `patient_zone` (green/yellow/orange) and `staff_alert_level` (none/yellow/orange/red); these are decoupled
- `appointments` (can be unscheduled with status `to_book`)
- `documents` (watermarked at view time)
- `staff_users` (with role: surgeon / optometrist / nurse / reception)
- `message_threads`, `messages`, `message_templates`
- `routing_rulesets`, `routing_rules` — see "Routing model" below
- `zone_content` — (zone × procedure × surgeon) with NULL = wildcard
- `staff_notes` (internal, append-only, never visible to patient)
- `manual_flags` (yellow/orange/red, decoupled from patient view)
- `audit_events` (append-only, retained 7 years)
- `clinic_profile`, `contact_options`, `doctors`, `partner_facilities`
- `user_preferences`, `symptom_options`, `zone_alert_actions`

Rest of the tables come in later sessions per the spec.

## Routing model (this is the trickiest bit — read carefully)

Every routable answer in the daily check-in — every value of pain (0–5), every value of light sensitivity (0–5), each vision option (Better/Same/Worse), and every symptom chip — has its own row in `routing_rules` with a single `route` column taking one of four values:

- `off` — no flag
- `yellow` — patient sees Yellow, staff reviews within 4h
- `orange` — patient sees Orange, staff contacts today
- `red` — **patient still sees Orange** (calming); staff gets an urgent Red alert with SMS + auto-call

Red is decoupled from what the patient sees. Patients never see a Red screen.

When evaluating a check-in, the engine looks up every answer, finds its rule, and computes:

- `patient_zone` = most severe patient-facing zone (Red collapses to Orange) → green / yellow / orange
- `staff_alert_level` = most severe routing returned (Red > Orange > Yellow > Off) → none / yellow / orange / red

Both are stored on the `check_ins` row and audit logged.

Rulesets are scoped by **procedure AND surgeon** with a four-tier most-specific-wins lookup, falling back per-rule (not per-ruleset):

1. (procedure × surgeon) ruleset
2. Surgeon-only ruleset (all procedures)
3. Procedure-only ruleset (all surgeons)
4. Default ruleset

So a (Dr Chen × LASIK) ruleset can override just one row and inherit everything else from the next level up. Same machinery as `zone_content` for Recovery guidance.

New symptoms added in Settings → Standard symptom options automatically get a `routing_rules` row created with `route = orange` (safer default).

## Critical rules (non-negotiable)

1. **No real patient data in development.** Use seeded fake patients with names like "Test Patient One". Real patient onboarding only after the privacy lawyer has signed off the privacy policy + consent flow.

2. **Australian data residency.** All data stays in Australia. Supabase project in Sydney region. No third-party analytics SDKs that ship data overseas (no Google Analytics, no Mixpanel, no Sentry without an EU/AU host).

3. **Encrypt everything.** Supabase encrypts at rest by default. Verify TLS 1.3 for all client-server traffic. Documents are stored in Supabase Storage with signed URLs that expire — never publicly accessible.

4. **Audit everything that touches a patient record.** Every staff view, edit, message send, manual flag, and ruleset edit generates an `audit_events` row with actor, action, before/after values, IP, user agent. The audit log is append-only (no edits, no deletes). Retained 7 years post-patient discharge.

5. **No diagnostic logic in the app.** Per the spec, this stays in "patient education and adherence" territory to avoid TGA medical-device regulation. The app collects symptom data and routes to zones based on staff-configured rules — it never says "you have X" or "you should take Y". Recommendations come from staff via messages, not from algorithms.

6. **Type safety.** TypeScript strict mode. No `any` types in domain code. Use Zod for runtime validation at API boundaries. Generate Supabase types with `supabase gen types typescript`.

7. **Tests.** Every business rule (zone routing, alert dispatch, medication scheduling, ruleset fallback) gets unit tests. Every API route gets an integration test. End-to-end tests for the critical paths (signup, daily check-in, message reply, manual flag).

8. **No caregiver / family access.** Deliberately removed for safeguarding reasons. Don't add it back.

## Visual style — match the prototype

The prototype demonstrates:

- **Five themes** the patient can switch between: Calm medical (default), Premium clinical, Bright & friendly, Sand & terracotta, Minimal modern. Plus dark mode for each. Implement these as CSS custom properties on `[data-theme="…"]` selectors, exactly like the prototype does.
- **Three zone colours** for recovery guidance shown to the patient: Green (on track), Yellow (mid-concern), Orange (highest concern, contact today). NOT red — patients in Orange are already anxious; alarming colours discourage them from calling.
- Red is a **staff-only** treatment used in the triage queue, push notifications, and audit log. Patients never see red.
- The Focus Vision logo (circular ring + sans-serif "FOCUS" + spaced "VISION") — SVG version exists in the prototype around line 3953, lift it directly. Font stack: 'Helvetica Neue', Helvetica, Arial. "FOCUS" is weight 700 at letter-spacing 2; "VISION" is weight 400 at letter-spacing 8.

When building UI:

1. Open the prototype HTML to see the exact visual you're recreating
2. Lift the styling approach (colours, spacing, typography, component patterns)
3. Use Tailwind utility classes that map to those tokens
4. Match the prototype layout — don't reinvent

## Folder structure

```
focus-vision-app/
├── src/
│   ├── app/
│   │   ├── (dashboard)/         # Staff web app routes
│   │   │   ├── patients/
│   │   │   ├── new-patients/    # New patients onboarding queue
│   │   │   ├── messages/
│   │   │   ├── triage/
│   │   │   ├── analytics/
│   │   │   ├── procedures/      # Procedures library — per-(surgeon × procedure) templates
│   │   │   ├── audit/           # Audit log viewer
│   │   │   ├── settings/
│   │   │   └── layout.tsx       # Dashboard chrome (sidebar)
│   │   ├── (patient)/           # Patient PWA routes
│   │   │   ├── home/
│   │   │   ├── medications/
│   │   │   ├── check-in/
│   │   │   ├── messages/
│   │   │   ├── documents/
│   │   │   ├── contact/
│   │   │   ├── settings/
│   │   │   └── layout.tsx       # Patient app chrome (bottom nav, theme support)
│   │   ├── api/                 # API routes
│   │   └── layout.tsx           # Root
│   ├── components/              # Shared UI components
│   ├── lib/
│   │   ├── supabase.ts          # Supabase client
│   │   ├── auth.ts              # Auth helpers (RLS-aware)
│   │   ├── audit.ts             # Audit logging
│   │   ├── zones.ts             # routeCheckIn() — 4-option router with ruleset fallback
│   │   └── content-sets.ts      # Recovery-guidance content lookup
│   ├── types/                   # Generated DB types + domain types
│   └── styles/
├── supabase/
│   ├── migrations/              # SQL migrations, numbered
│   └── seed.sql                 # Fake test data
├── tests/
├── public/
│   ├── manifest.json            # PWA manifest
│   └── service-worker.js        # PWA offline
└── package.json
```

## How to work

When I ask you to build something:

1. **Re-read the relevant spec section first** if you haven't recently
2. Tell me what you're about to do in one sentence before you do it
3. Make small, focused commits — one feature per commit
4. Write tests for business logic (not just UI)
5. After implementing, briefly describe what to verify manually
6. Don't add features that aren't in the spec without asking
7. If the spec is unclear, ask before guessing

## Common pitfalls to avoid

- **Don't mix patient and staff auth.** Two separate user types in Supabase Auth. Patients use email + SMS MFA. Staff use email + password + TOTP MFA.
- **Don't store patient phone numbers without verification.** SMS MFA is the verification mechanism — only persist the number after the code is confirmed.
- **Don't surface raw error messages to patients.** Wrap errors in friendly "Something went wrong — please try again or contact the clinic" messages.
- **Don't introduce notification noise.** Patients get notifications only for medication reminders, the daily check-in reminder, and direct messages from staff. Staff get notifications per their per-staff prefs (see spec section 5.7).
- **Don't break offline mode.** Medication reminders fire from the device; marking doses must work offline; daily check-ins queue locally. Test this.
- **Don't show Red to patients.** It's staff-only. Patient zones are green/yellow/orange. If you find yourself rendering a red banner on a patient screen, you've misread the spec.
- **Don't hard-delete medications.** Use soft-delete (`stopped_at`) so the clinical record is preserved.

## When you're stuck

If something in the spec is ambiguous or contradictory, **stop and ask** rather than guessing. Healthcare apps are not the place to guess. Examples of things to ask about:

- "The spec says X for LASIK but Y for cataract — which applies when both procedures are active?"
- "I want to add a database column for Z — does that belong on Patient or Procedure?"
- "The audit log says append-only — does that mean I should also prevent UPDATE on the row, or just my app code?"

Write the question, give your suggested answer with reasoning, and wait for confirmation before proceeding.

## What's already built and verified

- The product spec (`Focus_Vision_Recovery_Companion_Spec.docx`) — single source of truth
- The visual prototype (`focus_vision_prototype.html`) — every screen, every state, every interaction
- The data model (section 7 of the spec)
- The routing model with 4-state router and 4-tier ruleset fallback (section 6.7)
- The alert action configuration (section 6.7)

Nothing is implemented in code yet. You're starting from scratch.
