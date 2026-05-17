---
title: "Exporting audit log entries (CSV)"
section: "audit-log"
order: 3
video_url: null
video_duration_seconds: null
keywords: ["audit log", "export", "csv", "download", "compliance", "spreadsheet"]
related: ["audit-log/filtering-the-audit-log", "audit-log/what-the-audit-log-records", "analytics/compliance-audit-report"]
---

**What this is for:** Downloading audit entries as a CSV file so they can be reviewed in a spreadsheet or handed to an auditor.

## Who can export

Exporting is restricted to **tier-1 staff** — Owner, Admin, and Clinical Lead. The same access check runs again on the export itself.

## Exporting the entries

1. Open the **Audit log** from the sidebar.
2. Apply any category or search filters you need first.
3. Click **Export CSV** at the top right.
4. The file downloads automatically.

The CSV uses a clear file name showing the date range it covers. A CSV (comma-separated values) file opens in Excel, Numbers, or Google Sheets.

## What the file contains

Each row carries the timestamp, actor name and role, event type, patient name, the entity that was touched, and a short summary of the change.

:::tip
The export is capped at 5,000 rows, ordered newest first. If your range is larger, narrow the date window and export in batches.
:::

:::watch-out
The export is itself recorded in the audit log as an "Audit log exported" event — who exported, the filters used, and the row count. There is no off-the-record export.
:::

:::patient-sees
Nothing — this is staff-internal. Exported files may contain patient names, so store and share them securely.
:::

## What's next

- [Filtering and searching the audit log](/help/audit-log/filtering-the-audit-log)
- [What the audit log records and what it's for](/help/audit-log/what-the-audit-log-records)
- [Generating a compliance/audit summary report](/help/analytics/compliance-audit-report)
