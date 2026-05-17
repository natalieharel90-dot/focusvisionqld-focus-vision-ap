---
title: "Scheduling a push for later"
section: "bulk-push"
order: 5
video_url: null
video_duration_seconds: null
keywords: ["schedule push", "send later", "quiet hours", "timing", "deferred"]
related: ["bulk-push/sending-a-custom-message", "bulk-push/reading-the-history-tab", "bulk-push/building-a-cohort-filter"]
---

**What this is for:** Setting a bulk push to send at a future date and time instead of right away.

## Why schedule

Scheduling lets you prepare a push now and have it go out at the best moment — for example, a holiday closure notice timed for the morning before the break.

## How to schedule a push

1. Build your cohort and compose your message or content as usual.
2. In the "When to send" section, choose **Schedule for later**.
3. Pick the date and time in the date picker.
4. Click **Schedule for N patients** and confirm.
5. The push appears in the **History** tab marked **Scheduled**.

The cohort is re-evaluated when the push actually fires, so the recipients reflect who matches the filter at send time — not who matched when you scheduled it.

:::tip
Schedule times must be in the future. If you pick a time that has already passed, the push will not save.
:::

:::watch-out
A scheduled push that falls inside a patient's quiet hours is automatically held and delivered in the next allowed window, so the actual delivery time may differ slightly from the time you set.
:::

:::patient-sees
Nothing until the push fires. At that point each recipient gets the message in their app, just like a "send now" push.
:::

## What's next

- [Sending a custom message to a cohort](/help/bulk-push/sending-a-custom-message)
- [Reading the History tab and tracking opens](/help/bulk-push/reading-the-history-tab)
- [Building a cohort filter](/help/bulk-push/building-a-cohort-filter)
