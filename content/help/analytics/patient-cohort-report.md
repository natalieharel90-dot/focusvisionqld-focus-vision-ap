---
title: "Generating a patient cohort report"
section: "analytics"
order: 5
video_url: null
video_duration_seconds: null
keywords: ["cohort report", "patient cohort", "report", "outcome study", "filter", "procedure"]
related: ["analytics/per-surgeon-report", "analytics/monthly-activity-report", "analytics/reading-the-analytics-dashboard"]
---

**What this is for:** Building a list of patients who match a chosen set of filters — one row per patient — for surgeon outcome studies and cohort reviews.

## Who can generate it

Reports are tier-restricted. Clinic owners, admins, and clinical staff can generate cohort reports. Reception cannot.

## Generating the report

1. Open **Reports** from the sidebar.
2. Select the **Patient cohort report** tab.
3. Tick one or more **Procedures** to include.
4. Tick one or more **Surgeons** to include.
5. Set a surgery-date **From** and **To** range.
6. Optionally choose a **Current zone** to include only patients in that zone.
7. Decide whether to tick **Include patient identifiers**.
8. Click **Generate report**, then open it from **Previously generated**.

## What the report contains

One table row per matching patient, showing surgery date, recovery day, current zone, medication adherence, last check-in date, and message-thread status.

:::tip
Leave a filter group empty to mean "any" — for example, ticking no procedures includes every procedure type.
:::

:::watch-out
The zone filter uses the patient's most recent check-in zone. A patient who has never checked in will not match a specific zone filter.
:::

:::patient-sees
Nothing — this is staff-internal.
:::

## What's next

- [Generating a per-surgeon report](/help/analytics/per-surgeon-report)
- [Reading the analytics dashboard](/help/analytics/reading-the-analytics-dashboard)
- [Generating a monthly clinic activity report](/help/analytics/monthly-activity-report)
