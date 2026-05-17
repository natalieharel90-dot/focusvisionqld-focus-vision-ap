---
title: "Alert thresholds and routing rules"
section: "settings"
order: 7
video_url: null
video_duration_seconds: null
keywords: ["alert thresholds", "routing rules", "alert actions", "zones", "on-call", "triage"]
related: ["routing/where-routing-rules-live", "routing/the-four-option-router", "settings/managing-staff"]
---

**What this is for:** Setting how daily check-in answers map to zones, and what the system does — emails, alerts, SMS, calls — when a patient lands in each zone.

## Where it lives

This is under **Settings → Alert thresholds**. The page has two parts: the **routing rules** at the top and the **alert actions per zone** below.

## Routing rules

Each check-in answer — pain level, light sensitivity, vision, and each symptom chip — maps to one of four routes: **off**, **yellow**, **orange**, or **red**. Rules can be customised by procedure and by surgeon.

A full explanation of the routing model lives in the Routing section:

- [Where routing rules live](/help/routing/where-routing-rules-live)
- [The four-option router](/help/routing/the-four-option-router)

## Alert actions per zone

Below the rules, the **Alert actions** panel sets what happens for each zone.

1. For **Red**, **Orange**, and **Yellow**, toggle each action: email the clinic, in-app alert to all staff, push to on-call, SMS the on-call number, auto phone call.
2. For SMS, enter the **on-call number** in `+61…` format.
3. Optionally add an extra email recipient for Yellow and Orange.
4. Click **Save** on each zone card you change.

:::watch-out
Red is staff-only. The patient sees the same calming Orange screen — patients never see a Red alert. Reserve auto-calls for Orange and Red.
:::

:::patient-sees
Routing decides the patient's zone screen. Alert actions are staff-side only — the patient sees nothing change.
:::

## What's next

- [Where routing rules live](/help/routing/where-routing-rules-live)
- [The four-option router](/help/routing/the-four-option-router)
- [Adding and managing staff members](/help/settings/managing-staff)
