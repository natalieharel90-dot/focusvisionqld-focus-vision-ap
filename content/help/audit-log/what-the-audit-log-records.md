---
title: "What the audit log records and what it's for"
section: "audit-log"
order: 1
video_url: null
video_duration_seconds: null
keywords: ["audit log", "append-only", "staff actions", "privacy", "retention", "accountability"]
related: ["audit-log/filtering-the-audit-log", "audit-log/whats-auditable", "audit-log/exporting-audit-entries"]
---

**What this is for:** Keeping a permanent, tamper-proof record of every staff action that touches a patient record — for accountability and privacy compliance.

## What the audit log is

The audit log is an **append-only** record. New entries are added automatically, but no entry can ever be edited or deleted. It is the clinic's single source of truth for "who did what, when".

Every entry captures:

- **Actor** — the staff member (name, role, email) or "System".
- **Action** — what happened, such as a record edit or a message send.
- **Before and after values** — what the data looked like on each side of a change.
- **Timestamp** — the exact date and time.
- **IP address and device** — where the action came from.

## Why it exists

The audit log is required by **Australian Privacy Principle 11**, which obliges the clinic to protect patient information and account for access to it. It is also a clinical safeguard — every view of a patient record is traceable.

Entries are retained for **7 years after a patient is discharged**, in line with Australian clinical record retention standards.

:::tip
Click any row to open the detail drawer, which shows the full before-and-after values, IP address, and device.
:::

:::watch-out
There is no way to remove an audit entry — not even for admins. Treat every action you take as permanently recorded.
:::

:::patient-sees
Nothing — this is staff-internal. Patients do not see the audit log.
:::

## What's next

- [What's auditable vs. what isn't](/help/audit-log/whats-auditable)
- [Filtering and searching the audit log](/help/audit-log/filtering-the-audit-log)
- [Exporting audit log entries (CSV)](/help/audit-log/exporting-audit-entries)
