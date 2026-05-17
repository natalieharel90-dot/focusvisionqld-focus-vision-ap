---
title: "What's auditable vs. what isn't"
section: "audit-log"
order: 4
video_url: null
video_duration_seconds: null
keywords: ["audit log", "auditable", "staff actions", "scope", "patient activity", "coverage"]
related: ["audit-log/what-the-audit-log-records", "audit-log/filtering-the-audit-log", "audit-log/exporting-audit-entries"]
---

**What this is for:** Setting clear expectations about what the audit log captures — and what it deliberately does not.

## What is auditable

The audit log records **staff actions that touch a patient record**. This includes:

- Viewing a patient record, a check-in, or a document.
- Creating or editing a patient record.
- Adding or stopping a medication, procedure, or appointment.
- Adding an internal note.
- Sending a message or a bulk push.
- Raising or resolving a manual flag.
- Applying a procedure template.
- Settings changes — routing rules, alert actions, symptoms, templates.
- Sign-ins, sign-outs, and even viewing or exporting the audit log itself.

Each entry is bucketed into a category: patient access, record edits, message activity, manual flags, or system actions.

## What is not in the audit log

- **Patient app activity** — a patient taking a dose or completing a check-in is stored in their record, not in the staff audit log.
- **Aggregate analytics** — the analytics dashboard shows clinic-wide numbers with no individual entries.
- **Draft or unsaved work** — only committed actions are logged.

:::tip
If you cannot find an action in the audit log, check the patient's own record first — patient-driven activity lives there, not in the staff log.
:::

:::watch-out
Because viewing a record is itself auditable, never open a patient record you have no clinical reason to see. Curiosity browsing leaves a permanent trace.
:::

:::patient-sees
Nothing — this is staff-internal.
:::

## What's next

- [What the audit log records and what it's for](/help/audit-log/what-the-audit-log-records)
- [Filtering and searching the audit log](/help/audit-log/filtering-the-audit-log)
- [Exporting audit log entries (CSV)](/help/audit-log/exporting-audit-entries)
