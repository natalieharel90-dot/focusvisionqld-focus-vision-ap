---
title: "Per-procedure and per-surgeon overrides"
section: "recovery-guidance"
order: 3
video_url: null
video_duration_seconds: null
keywords: ["override", "procedure", "surgeon", "zone content", "fallback", "scope"]
related: ["recovery-guidance/editing-zone-screens", "recovery-guidance/previewing-as-a-patient", "routing/procedure-surgeon-overrides"]
---

**What this is for:** Tailoring zone screens for one procedure or one surgeon without rewriting the clinic-wide guidance.

## How scoping works

Recovery guidance is scoped by **zone, procedure, and surgeon**. It uses the same four-tier, most-specific-wins lookup as routing rules:

1. **Procedure × surgeon** — e.g. Dr Chen × LASIK
2. **Surgeon only** — all of that surgeon's patients
3. **Procedure only** — all patients having that procedure
4. **Default** — the clinic-wide guidance

## Per-field fallback

The fallback walks **one field at a time**. A LASIK override can change just the **Today's tip** on the Green screen and inherit the headline, message, and everything else from the Default screen.

That means overrides stay small — you only fill in the fields that genuinely differ for that procedure or surgeon.

## Creating an override

1. Open **Settings → Recovery guidance**.
2. Use the **Procedure** and **Surgeon** pickers at the top to choose the scope.
3. Edit only the fields that should differ for that scope.
4. Click **Save** for the zone you changed.

The page tells you which tier you are editing and how the fallback will resolve.

:::patient-sees
A patient in the chosen scope sees the overridden fields, blended with inherited fields from the tiers above — one seamless screen.
:::

:::tip
Leave a field matching the parent and it cleanly falls back. Only change what is truly procedure- or surgeon-specific.
:::

:::watch-out
Editing the Default scope changes guidance for every patient without a more-specific override. Set the pickers before you type.
:::

## What's next

- [Editing the green / yellow / orange screens](/help/recovery-guidance/editing-zone-screens)
- [Previewing as a patient before saving](/help/recovery-guidance/previewing-as-a-patient)
- [Procedure × surgeon routing overrides](/help/routing/procedure-surgeon-overrides)
