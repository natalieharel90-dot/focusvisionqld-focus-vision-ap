---
title: "Adding a new symptom and what happens automatically"
section: "routing"
order: 6
video_url: null
video_duration_seconds: null
keywords: ["add symptom", "new symptom", "chip", "default rule", "orange", "settings"]
related: ["routing/symptom-chip-routing", "settings/alert-thresholds", "settings/patient-feature-toggles"]
---

**What this is for:** Adding a new symptom chip to the daily check-in and knowing what the system sets up for you.

## Adding the symptom

1. Open **Settings → Standard symptoms**.
2. Click **+ Add symptom**.
3. Enter a patient-facing **Label** (e.g. "Blurred vision").
4. Enter a **Key** in snake_case (e.g. `blurred_vision`).
5. Set an **Order index** to control where the chip appears in the list.
6. Click **Add symptom**.

The new chip appears in the patient's check-in straight away. The "Other" free-text chip always stays last.

## What happens automatically

When you add a symptom, the system creates a routing rule for it in the **Default ruleset** with the route set to **Orange**.

Orange is the deliberate safe default — a brand-new symptom prompts staff to contact the patient today until you decide otherwise. It is always safer to start cautious and relax the rule later.

:::patient-sees
A new chip appears in the check-in symptom list. Tapping it routes to Orange until staff change the rule — the patient sees the calm Orange screen.
:::

:::tip
After adding a symptom, open **Settings → Alert thresholds** and adjust its route if Orange is too cautious or not cautious enough.
:::

:::watch-out
Removing a symptom also removes its auto-created routing rule, so no orphan rule is left behind for a chip patients can no longer pick.
:::

## What's next

- [Symptom chip routing](/help/routing/symptom-chip-routing)
- [Alert thresholds settings](/help/settings/alert-thresholds)
- [Patient app feature toggles](/help/settings/patient-feature-toggles)
