---
title: "Where routing rules live and how to edit them"
section: "routing"
order: 1
video_url: null
video_duration_seconds: null
keywords: ["routing rules", "alert thresholds", "settings", "ruleset", "check-in"]
related: ["routing/the-four-option-router", "routing/per-level-routing", "settings/alert-thresholds"]
---

**What this is for:** Finding the screen where you decide what happens after a patient answers their daily check-in.

## Where to find them

Routing rules turn each check-in answer into an outcome — no flag, a Yellow review, an Orange contact, or an urgent Red alert.

1. Open **Settings** from the sidebar.
2. Click the **Alert thresholds** tab.
3. The rules editor loads, grouped into pain, light sensitivity, vision, and symptom chips.

A "ruleset" is the full collection of rules for a given scope. The page opens on the **Default** ruleset, which every patient uses unless a more-specific ruleset overrides it.

## Editing a rule

Each answer has its own row with a four-option control.

1. Find the row for the answer you want to change.
2. Click **Off**, **Yellow**, **Orange**, or **Red**.
3. Click **Save** at the bottom of the group.

:::patient-sees
Nothing changes immediately. The next time a patient gives that answer in a check-in, the new outcome applies.
:::

:::tip
Use the **Procedure** and **Surgeon** pickers at the top to narrow the scope before editing — see the overrides article.
:::

:::watch-out
Every rule change is written to the audit log with your name, the old value, and the new value.
:::

## What's next

- [The four-option router — Off / Yellow / Orange / Red explained](/help/routing/the-four-option-router)
- [Per-level routing for graded items](/help/routing/per-level-routing)
- [Procedure × surgeon overrides](/help/routing/procedure-surgeon-overrides)
