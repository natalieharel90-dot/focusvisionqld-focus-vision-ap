---
title: "A patient says they're not getting medication reminders"
section: "troubleshooting"
order: 2
video_url: null
video_duration_seconds: null
keywords: ["medication reminders", "notifications", "patient app", "push", "missed dose", "phone settings"]
related: ["patient-experience/patient-medications-screen", "settings/patient-feature-toggles", "troubleshooting/patient-didnt-get-message"]
---

**What this is for:** Working out why a patient is not seeing their medication reminders, and what to check first.

Medication reminders fire from the **patient's own phone**, not from our servers. The phone must have notifications switched on for the app. SMS reminders are not connected for this flow yet, so the in-app notification is the only alert.

## Things to check, in order

1. Confirm the patient has actually opened and installed the app on their phone.
2. Ask them to check that notifications are turned **on** for the app in their phone's settings.
3. Ask them to check Do Not Disturb or Focus mode is not silencing the app.
4. In the patient record, confirm the medication is still active and has not been stopped.
5. Confirm the reminder times on the medication are correct and in the patient's time zone.
6. Ask the patient to open the app once — reminders can pause if the app has not been opened in a long time.
7. If they have a new phone, they must reinstall the app and allow notifications again.

:::patient-sees
With notifications on, the patient gets a reminder on their lock screen at each dose time. With notifications off, the medication still shows in the app, but no reminder ever appears — so they only see it if they open the app themselves.
:::

:::watch-out
Marking a dose still works offline, but reminders need the app installed and notifications allowed. A patient with notifications off will miss every reminder silently.
:::

:::tip
The fastest fix is almost always the phone's notification setting — start there before checking anything in the dashboard.
:::

## What's next

- [The patient medications screen](/help/patient-experience/patient-medications-screen)
- [Patient feature toggles](/help/settings/patient-feature-toggles)
- [A patient didn't get a message](/help/troubleshooting/patient-didnt-get-message)
