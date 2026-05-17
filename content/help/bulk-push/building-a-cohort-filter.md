---
title: "Building a cohort filter"
section: "bulk-push"
order: 2
video_url: null
video_duration_seconds: null
keywords: ["cohort filter", "recovery day", "procedure", "surgeon", "flag status", "check-in zone"]
related: ["bulk-push/sending-a-custom-message", "bulk-push/bulk-push-vs-individual", "bulk-push/scheduling-a-push"]
---

**What this is for:** Narrowing down exactly which patients a bulk push reaches before you send it.

## What a cohort is

A **cohort** is the group of patients a push goes to. You build it with filters on the Compose tab. Only patients with an active procedure can be included — discharged patients never match.

## The available filters

Combine any of these — patients must match every filter you set:

- **Procedure** — one or more procedure types, such as LASIK or PRK.
- **Surgeon** — one or more surgeons.
- **Recovery day range** — days since surgery, where day 0 is the surgery day.
- **Surgery date range** — patients whose surgery fell between two calendar dates.
- **Manual flag status** — any, no open flag, or a yellow, orange, or red flag.
- **Last check-in zone** — any, green, yellow, or orange.

## How to build one

1. Open **Bulk push** and stay on the **Compose** tab.
2. Tap the procedure and surgeon chips you want.
3. Set a recovery day range or surgery date range if needed.
4. Set the flag status and last check-in zone filters if needed.
5. Watch the live preview panel — it shows the count and a sample of matched patients.

:::tip
Leave a filter blank to mean "any". An empty cohort filter matches every active patient.
:::

:::watch-out
If the count is zero, the push button stays disabled. Loosen a filter — a too-narrow combination often matches no one.
:::

:::patient-sees
Nothing yet — building a filter is staff-internal. Patients only see something once the push is sent.
:::

## What's next

- [Sending a custom message to a cohort](/help/bulk-push/sending-a-custom-message)
- [Scheduling a push for later](/help/bulk-push/scheduling-a-push)
- [When to use bulk push vs. individual messages](/help/bulk-push/bulk-push-vs-individual)
