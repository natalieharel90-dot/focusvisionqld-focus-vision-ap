---
title: "Where to find logs when something goes wrong (audit log + browser console)"
section: "troubleshooting"
order: 5
video_url: null
video_duration_seconds: null
keywords: ["logs", "audit log", "browser console", "developer console", "error", "f12", "troubleshooting"]
related: ["audit-log/what-the-audit-log-records", "audit-log/filtering-the-audit-log", "troubleshooting/dashboard-looks-broken"]
---

**What this is for:** Knowing which of the two logs to check when something goes wrong, so you can confirm what happened or capture an error to report.

There are two different logs, and they answer two different questions. Use whichever one fits the problem.

## The audit log — what happened to a patient record

The **audit log** records every staff action: every record viewed, every edit, every message sent, every flag, every ruleset change. Use it when you need to confirm whether something actually happened.

1. Open **Audit log** from the sidebar.
2. Filter by patient name, staff member, or date to narrow the list.
3. Each entry shows who did what, when, and the before-and-after values.

This answers questions like "was that message really sent?" or "who changed this patient's medication?".

## The browser console — technical errors on screen

The **developer console** is a hidden panel built into your browser that shows technical errors. Use it when a page looks broken or will not load.

1. Press **F12** on your keyboard (or right-click the page and choose **Inspect**).
2. Select the **Console** tab.
3. Look for lines shown in red — those are errors.
4. Take a screenshot of the red text to send with your fault report.

:::tip
When reporting any fault, include the page name, the time, and a screenshot of the red console errors. It saves a lot of back-and-forth.
:::

:::watch-out
The audit log is append-only and permanent — you cannot edit or delete entries, and that is intentional. The console only shows errors from your current session and clears when you reload.
:::

## What's next

- [What the audit log records](/help/audit-log/what-the-audit-log-records)
- [Filtering the audit log](/help/audit-log/filtering-the-audit-log)
- [The dashboard looks broken](/help/troubleshooting/dashboard-looks-broken)
