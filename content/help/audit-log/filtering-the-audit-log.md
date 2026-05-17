---
title: "Filtering and searching the audit log"
section: "audit-log"
order: 2
video_url: null
video_duration_seconds: null
keywords: ["audit log", "filter", "search", "category", "pagination", "events"]
related: ["audit-log/what-the-audit-log-records", "audit-log/exporting-audit-entries", "audit-log/whats-auditable"]
---

**What this is for:** Narrowing the audit log down to the events you need, so you can answer a specific "who did what" question quickly.

## Who can access it

The audit log is restricted to **tier-1 staff** — Owner, Admin, and Clinical Lead. Other staff see a 403 access-denied page.

## Filtering by category

The category chips at the top of the page narrow the list to one type of activity:

- **All events** — everything.
- **Patient access** — record and check-in views, document views.
- **Record edits** — changes to patient records.
- **Message activity** — messages and bulk pushes.
- **Manual flags** — flags raised and resolved.
- **System actions** — sign-ins, settings changes, and the like.

1. Click a category chip to filter the table.
2. Click **All events** to clear the category filter.

## Searching

1. Type into the **Search** box at the top right.
2. The search matches staff name, patient name, and the action.
3. Results update when you submit the search.

The summary cards above the table show events today, record edits, patient access, and any flagged anomalies.

:::tip
The table shows 20 events per page. Use **Previous** and **Next** at the bottom to move through older entries.
:::

:::watch-out
Anomaly detection flags unusual patterns — for example, one staff member opening 50 or more records in an hour — for the Privacy Officer to review.
:::

:::patient-sees
Nothing — this is staff-internal.
:::

## What's next

- [Exporting audit log entries (CSV)](/help/audit-log/exporting-audit-entries)
- [What's auditable vs. what isn't](/help/audit-log/whats-auditable)
- [What the audit log records and what it's for](/help/audit-log/what-the-audit-log-records)
