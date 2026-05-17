---
title: "The four routing outcomes (Off / Yellow / Orange / Red) — what each means"
section: "check-ins"
order: 2
video_url: null
video_duration_seconds: null
keywords: ["routing", "zones", "red", "orange", "yellow", "alert level", "patient zone"]
related: ["check-ins/what-a-check-in-is", "check-ins/reading-the-triage-queue", "check-ins/what-the-patient-sees-after-check-in"]
---

**What this is for:** Understanding the four outcomes the routing engine can produce, and why what the patient sees is not always what staff see.

## Two results, not one

Every check-in produces two separate results:

- **Patient zone** — the colour screen the patient sees: green, yellow, or orange.
- **Staff alert level** — how urgently staff need to respond: none, yellow, orange, or red.

The routing engine reads every answer, finds the most severe outcome, and sets both.

## The four outcomes

- **Off** — no concern. The patient sees **green**. No triage card is created.
- **Yellow** — mild concern. The patient sees **yellow**. A yellow triage card is created — review within 4 hours.
- **Orange** — higher concern. The patient sees **orange**. An orange triage card is created — contact the patient today.
- **Red** — urgent. The patient still sees **orange** (a calm screen), but staff get a red triage card plus an SMS and an automated call.

## Why red is hidden from the patient

A patient in distress who sees an alarming red screen may panic or, worse, avoid calling. So the patient always sees the calm orange screen. Staff get the full red urgency through the triage queue and notifications.

:::patient-sees
The patient only ever sees green, yellow, or orange. They never see a red screen, even when staff are on a red alert.
:::

:::watch-out
A red card means **act immediately** — do not wait for the patient to call. The patient does not know it is red.
:::

## What's next

- [Reading the triage queue](/help/check-ins/reading-the-triage-queue)
- [What the patient sees after submitting a check-in](/help/check-ins/what-the-patient-sees-after-check-in)
- [Where routing rules live](/help/routing/where-routing-rules-live)
