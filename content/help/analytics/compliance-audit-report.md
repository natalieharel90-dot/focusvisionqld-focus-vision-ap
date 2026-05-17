---
title: "Generating a compliance/audit summary report"
section: "analytics"
order: 4
video_url: null
video_duration_seconds: null
keywords: ["compliance report", "audit summary", "report", "record edits", "data exports", "admin actions"]
related: ["analytics/monthly-activity-report", "audit-log/what-the-audit-log-records", "audit-log/exporting-audit-entries"]
---

**What this is for:** Producing a privacy-and-governance summary for an audit window — who edited records, what admin changes were made, and which data exports happened.

## Who can generate it

Reports are tier-restricted. Clinic owners, admins, and clinical staff can generate the compliance summary. Reception cannot.

## Generating the report

1. Open **Reports** from the sidebar.
2. Select the **Compliance / audit summary** tab.
3. Set a **From** and **To** date (leave blank for the last 6 months).
4. Click **Generate report**, then open it from **Previously generated**.

## What the report contains

- **Record edits by staff member** — a count of patient-record changes per staff member.
- **Admin actions** — settings changes such as routing rules, alert actions, and template edits.
- **Data exports** — each CSV export or document view, with who did it and when.
- **RLS-blocked access attempts** — a note on blocked access. Row-Level Security (RLS) is the database layer that stops staff seeing records they are not permitted to.

:::tip
This report is built directly from the audit log, so it is a faithful governance summary. For line-by-line detail, use the audit log itself.
:::

:::watch-out
The report summarises activity — it does not list every event. For a full record-by-record trail, export the audit log instead.
:::

:::patient-sees
Nothing — this is staff-internal.
:::

## What's next

- [What the audit log records and what it's for](/help/audit-log/what-the-audit-log-records)
- [Exporting audit log entries (CSV)](/help/audit-log/exporting-audit-entries)
- [Generating a monthly clinic activity report](/help/analytics/monthly-activity-report)
