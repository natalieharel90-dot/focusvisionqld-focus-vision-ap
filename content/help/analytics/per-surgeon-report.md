---
title: "Generating a per-surgeon report"
section: "analytics"
order: 3
video_url: null
video_duration_seconds: null
keywords: ["per-surgeon report", "surgeon", "report", "outcomes", "flag rate", "adherence"]
related: ["analytics/monthly-activity-report", "analytics/patient-cohort-report", "analytics/reading-the-analytics-dashboard"]
---

**What this is for:** Summarising one surgeon's recovery outcomes over a date range — useful for reviews, audits, and outcome studies.

## Who can generate it

Reports are tier-restricted. Clinic owners, admins, and clinical staff can generate per-surgeon reports. Reception cannot.

## Generating the report

1. Open **Reports** from the sidebar.
2. Select the **Per-surgeon report** tab.
3. Choose a **Surgeon** from the dropdown — this field is required.
4. Set a **From** and **To** date (leave blank for the last 90 days).
5. Decide whether to tick **Include patient identifiers**.
6. Click **Generate report**, then open it from **Previously generated**.

## What the report contains

- **Summary** — patient count, medication adherence, and median message response time.
- **Manual-flag rate** — flags raised per 100 patient recovery-days, so surgeons with more patients are compared fairly.
- **Zone distribution** — the spread of check-in zones across the surgeon's patients.
- **Flagged patients** — each flagged patient with recovery day, flag level, and whether the flag is open or resolved.

:::tip
The flag rate is normalised per 100 recovery-days, so it is a fair comparison even when one surgeon has many more patients than another.
:::

:::watch-out
The date range filters by **surgery date**, not by check-in date. A patient whose surgery falls outside the range will not appear, even if they checked in during it.
:::

:::patient-sees
Nothing — this is staff-internal.
:::

## What's next

- [Generating a patient cohort report](/help/analytics/patient-cohort-report)
- [Generating a monthly clinic activity report](/help/analytics/monthly-activity-report)
- [Reading the analytics dashboard](/help/analytics/reading-the-analytics-dashboard)
