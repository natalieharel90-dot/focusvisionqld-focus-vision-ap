---
title: "The four-option router — Off / Yellow / Orange / Red explained"
section: "routing"
order: 2
video_url: null
video_duration_seconds: null
keywords: ["router", "off", "yellow", "orange", "red", "alert level", "zone"]
related: ["routing/where-routing-rules-live", "routing/per-level-routing", "check-ins/four-routing-outcomes"]
---

**What this is for:** Understanding the four outcomes you can assign to any check-in answer.

## The four routes

Every routable answer carries exactly one `route` value:

- **Off** — no flag. The answer is expected and needs no attention.
- **Yellow** — the patient sees a Yellow screen. Staff review the check-in within 4 hours.
- **Orange** — the patient sees an Orange screen. Staff contact the patient today.
- **Red** — the patient **still sees Orange** (a calm screen). Staff get an urgent Red alert with an SMS and an auto-call.

## Why Red is decoupled

Red is the most urgent staff outcome, but patients never see a Red screen. An alarming colour can discourage an already-anxious patient from picking up the phone. So Red sends the loud alert to staff while keeping the patient on the calming Orange screen.

:::patient-sees
The patient only ever sees Green, Yellow, or Orange. A Red rule shows them Orange — they are unaware staff received an urgent alert.
:::

## How a whole check-in is scored

When a patient submits a check-in, the engine looks up every answer and combines the results:

- **Patient zone** = the most severe patient-facing zone, with Red collapsed to Orange.
- **Staff alert level** = the most severe route returned, where Red beats Orange beats Yellow beats Off.

Both values are saved on the check-in and audit logged.

:::tip
Reach for Red sparingly — for answers that genuinely need a same-hour phone call, like sudden vision loss.
:::

## What's next

- [Per-level routing for graded items](/help/routing/per-level-routing)
- [The four routing outcomes for staff](/help/check-ins/four-routing-outcomes)
- [Where routing rules live](/help/routing/where-routing-rules-live)
