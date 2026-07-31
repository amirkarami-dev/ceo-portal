# Guides — documents written for people, not for the build

Standalone HTML documents that explain a service to somebody who has to **use**, **present** or
**approve** it. Open one in a browser; there is no build step and no external asset, so they work
from a file share, an email attachment or a laptop with no internet.

This is deliberately not where design or engineering notes live:

| Folder | Audience | Question it answers |
|---|---|---|
| **`docs/guides/`** | stakeholders, admins, new staff | *how does this service work?* |
| [`docs/superpowers/specs/`](../superpowers/specs) | whoever builds it | *what are we building, and why this way?* |
| [`docs/worklog/`](../worklog) | whoever comes next | *what was done, what broke, what is still unproven* |
| [`docs/ai/`](../ai) | an agent picking the repo up | map, gotchas, deploy rules |

## The guides

| File | Language | Covers |
|---|---|---|
| [`election-service-fa.html`](election-service-fa.html) | فارسی، RTL | سامانهٔ انتخابات — رأی مخفی، گردش کار وب و ربات بله، شمارش، نگهداری ۳۰ روزه |
| [`room-service-fa.html`](room-service-fa.html) | فارسی، RTL | جلسات آنلاین — جلسه و ارائه، سه راه ورود، گفتگو، سرور ویدیو |
| [`mabhas19-guide.html`](mabhas19-guide.html) | English | Mabhas19 platform — system and developer guide |

## Rules for anything added here

- **Describe what shipped, not what was designed.** Where a security review changed a decision, the
  guide carries the final behaviour. The spec keeps the history; this does not.
- **Say what is still unproven.** Each guide ends with a «وضعیت فعلی» / status section naming what has
  never been exercised with real users. A guide that implies more confidence than the worklog does is
  worse than no guide.
- **Self-contained.** No CDN, no webfont URL, no build. Persian falls back through a stack that ends at
  Tahoma, which every Windows machine in the organisation has.
- **Both themes.** Each file carries its own light/dark toggle and follows the OS preference until the
  reader chooses otherwise.
