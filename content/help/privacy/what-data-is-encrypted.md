---
title: "What patient data is encrypted and how"
section: "privacy"
order: 3
video_url: null
video_duration_seconds: null
keywords: ["encryption", "tls", "data at rest", "documents", "signed urls", "security"]
related: ["privacy/australian-privacy-apps", "privacy/why-we-audit-everything", "privacy/reporting-a-concern"]
---

**What this is for:** Explaining, in plain terms, how the Recovery Companion keeps patient data protected — so staff can answer patient questions with confidence.

## Two kinds of encryption

**Encryption** scrambles data so only the system can read it. The Recovery Companion uses it in two places:

- **In transit** — every connection between a device and the system uses TLS 1.3, the current secure-connection standard. Nobody on the network can read data as it travels.
- **At rest** — all data stored in the database is encrypted on disk. A stolen drive would be unreadable.

## Documents and photos

Surgical documents and eye photos are kept in protected storage, never on a public web address. The app reaches them through **signed URLs** — temporary links that **expire** after a short time. Documents are also watermarked when viewed.

## Where the data lives

All of this runs in the Sydney region, so patient data stays in Australia. Patient sign-in is protected with SMS verification; staff sign-in adds an authenticator code.

:::tip
If a patient asks "is my information safe?", you can say yes: it is encrypted in transit and at rest, stored in Australia, and access is logged.
:::

:::watch-out
Encryption only protects data inside the system. The moment you screenshot, download, or paste patient data elsewhere, that protection is gone.
:::

:::patient-sees
Nothing — this is staff-internal. Patients benefit from these protections automatically without seeing them.
:::

## What's next

- [Australian privacy obligations (APPs)](/help/privacy/australian-privacy-apps)
- [Why we audit everything](/help/privacy/why-we-audit-everything)
- [Reporting a privacy or security concern](/help/privacy/reporting-a-concern)
