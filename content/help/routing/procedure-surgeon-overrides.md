---
title: "Procedure × surgeon overrides — when and how to use them"
section: "routing"
order: 5
video_url: null
video_duration_seconds: null
keywords: ["override", "procedure", "surgeon", "ruleset", "fallback", "scope"]
related: ["routing/where-routing-rules-live", "routing/the-four-option-router", "recovery-guidance/guidance-overrides"]
---

**What this is for:** Tuning routing for one procedure or one surgeon without rewriting the whole rule set.

## The four tiers

Routing rules are scoped by **procedure and surgeon**. When the engine needs a rule for a patient, it looks through four tiers, most specific first:

1. **Procedure × surgeon** — e.g. Dr Chen × LASIK
2. **Surgeon only** — all of that surgeon's patients
3. **Procedure only** — all patients having that procedure
4. **Default** — the clinic-wide ruleset

## Per-rule fallback

The fallback works **one rule at a time**, not one ruleset at a time. A Dr Chen × LASIK ruleset can override just a single row — say, the pain level 3 rule — and inherit every other rule from the tiers above it.

That keeps overrides small. You only store the rows that genuinely differ.

## Creating an override

1. Open **Settings → Alert thresholds**.
2. Use the **Procedure** and **Surgeon** pickers to choose the scope.
3. Change only the rows that should differ for that scope.
4. Click **Save**.

The ruleset for that scope is created automatically the first time you save into it.

:::patient-sees
Nothing visible. Patients in the chosen scope simply get the overridden outcome on their next matching check-in.
:::

:::tip
Set a row back to match the tier above and the override is removed — the rule cleanly inherits again.
:::

:::watch-out
Edit the Default ruleset and the change reaches every patient who has no more-specific override for that row. Use the pickers deliberately.
:::

## What's next

- [Where routing rules live](/help/routing/where-routing-rules-live)
- [The four-option router](/help/routing/the-four-option-router)
- [Per-procedure and per-surgeon guidance overrides](/help/recovery-guidance/guidance-overrides)
