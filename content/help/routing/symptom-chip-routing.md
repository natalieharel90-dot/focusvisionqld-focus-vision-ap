---
title: "Symptom chip routing"
section: "routing"
order: 4
video_url: null
video_duration_seconds: null
keywords: ["symptom", "chip", "routing", "check-in", "flag", "escalate"]
related: ["routing/adding-a-new-symptom", "routing/the-four-option-router", "settings/message-templates"]
---

**What this is for:** Deciding what happens when a patient taps a symptom chip during their check-in.

## What a symptom chip is

If a patient answers "Yes" to having unusual symptoms, the check-in shows a set of tappable "chips" — short labels like "Flashes of light" or "Discharge from eye". An "Other" chip with a free-text box is always shown last.

Each chip is a routable answer, so each one has its own rule row with a single route.

## Setting chip routes

1. Open **Settings → Alert thresholds**.
2. Scroll to the **Symptoms** group.
3. For each chip, pick **Off**, **Yellow**, **Orange**, or **Red**.
4. Click **Save**.

Chips lean cautious. "Flashes of light", for instance, is usually set to **Red** because it can signal retinal traction and warrants a same-hour call. A symptom that is often harmless, like "Excessive watering", might sit at **Yellow** as a safety net.

:::patient-sees
Tapping a chip never shows the patient a scary message. The most severe chip they pick sets their zone — Green, Yellow, or Orange. A Red chip shows them the calm Orange screen.
:::

:::tip
When several chips are tapped in one check-in, the most severe route wins. Set each chip to the route that fits it on its own.
:::

:::watch-out
The "Other" free-text chip cannot be routed by keyword. Treat any check-in with an "Other" entry as worth a manual read.
:::

## What's next

- [Adding a new symptom and what happens automatically](/help/routing/adding-a-new-symptom)
- [The four-option router](/help/routing/the-four-option-router)
- [Quick reply templates](/help/messaging/quick-reply-templates)
