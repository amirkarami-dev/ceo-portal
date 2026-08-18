# room-web redesign — visual and motion language

- **Date:** 2026-08-18
- **Area:** room-web (presentation only — no logic changes)
- **Status:** direction, awaiting go-ahead

## What is wrong today

Nothing is broken. It is *borrowed*. `tokens.ts` opens by explaining that blue was chosen because
"this dashboard is dense with green=success / red=failed status indicators… which fits a
**background-job monitor**". That is `mun-sanandaj-web`'s reasoning, copied wholesale. The stylesheet
still ships a `.mun-live-dot` class. The result is a competent admin skin wearing a meetings app.

Meetings are not a job monitor. They are about **time** (a room opens, runs, ends) and **presence**
(who is here, who is speaking). The current UI states both as small grey text.

## The one idea

**Time is the spine.** Every surface shows where *now* sits in the meeting's life, using one device
rather than a sentence: a thin luminous rail that fills as the meeting approaches, turns live, and
goes quiet when it ends.

- **The meetings list** — each card carries the rail down its leading edge. Position and colour say
  "in three days" / "doors open" / "live now" before any text is read.
- **The guest landing** — ~~the countdown *is* the rail, at full size.~~ **Dropped at step 4.** The
  rail earns its place on the meetings list because there are many cards to compare; a landing page
  has nothing to compare against, and any progress bar there needs an origin the data does not
  supply. At three days out it would read "somewhat close" while the digits already say «۳ روز», and
  in the final hour it would sit saturated at exactly the moment that matters most. So the landing
  page gets the countdown at display scale instead, and the decorative 64px bar under it was removed
  rather than replaced.
- **Inside a meeting** — a 2px live line under the title bar, quietly showing elapsed against
  scheduled duration.

It encodes something true and already computed (`startsAt`, `durationMinutes`, `canJoinNow`,
`liveCount`). It is not decoration.

## Tokens

### Colour — inside the estate's own palette, not a new identity

room-web sits in a launcher with ten sibling apps; inventing a fresh brand here would break that
family. So the palette comes from the documented estate palette, with roles assigned for meetings:

| token | value | role |
|---|---|---|
| `brand` | `#326BFC` | the estate blue. Primary actions, focus, the rail before a meeting starts |
| `onair` | `#FD411E` | **live only.** Never an error colour in this app — errors use `danger` |
| `soon` | `#FCBB21` | doors open, joinable |
| `ok` | `#24AF7E` | confirmed, saved |
| `danger` | `#E5484D` | destructive and failure, deliberately distinct from `onair` |
| `ink` | `#070B14` | the meeting ground: near-black with a blue bias, not neutral grey |
| `paper` | `#F5F7FB` | light ground |

**Why `onair` and `danger` are two different reds:** in a video product red means "on air"
everywhere. Using one red for both would make "you are live" and "this failed" the same signal. They
are paired with an icon and a word in every use, so colour never carries the meaning alone.

### Type — Persian first, and no borrowed Latin habits

**Vazirmatn**, already installed, stays. The character comes from how it is set, not from a new face:

- **Display** 700/800 at −0.5px tracking for screen titles and the countdown.
- **Body** 400, 1.75 line height.
- **Numerals** are a designed element, not an afterthought: `tabular-nums` everywhere, slightly
  loosened tracking. This app is made of times, counts and durations; they should line up in a column
  and never reflow as they tick.

**Rejected: the uppercase eyebrow.** Small uppercase labels above headings are the reflex move and
Persian has no capitals — applying it would produce either Latin text in a Persian UI or nothing at
all. The utility role is instead size + colour + a leading hairline.

### Motion — one rhythm, stated once

| token | value | used for |
|---|---|---|
| `--m-fast` | 160ms | press, hover, colour |
| `--m-base` | 240ms | panels, tabs, crossfade |
| `--m-enter` | 320ms | first paint of a view |
| easing | `cubic-bezier(.2,.8,.2,1)` | everything entering |
| stagger | 40ms | list items |

Rules: entrances rise 8px and fade; exits are ~60% of the enter duration; only `transform` and
`opacity` animate; one moving thing per view. Under `prefers-reduced-motion` every one of these
collapses, and antd's own `motion: false` stays as it is — that switch is load-bearing, not a nicety:
without it a Drawer is parked off-screen by a transform whose end event never arrives.

## The signature moment

**The nav indicator is one object that moves.** The sidebar's active marker is a single element that
slides between items (`layoutId`) rather than two markers fading in and out. It is small, it is the
thing you see on every page, and it makes the shell feel built rather than assembled.

Everything else stays quiet. One memorable element, not five.

## Per-surface plan

| surface | what changes | logic |
|---|---|---|
| `tokens.ts` | the palette above, elevation scale, motion tokens; the job-monitor rationale replaced | none |
| `global.css` | base layer, focus ring, reduced-motion, `.mun-*` renamed | none |
| `AppLayout` | translucent rail, sliding active indicator, denser header | none |
| `MyMeetings` | cards gain the time rail, staggered entrance, live pulse | none |
| `RoomsList` / `RoomForm` | same tokens, clearer grouping, no structural change | none |
| `JoinPage` / `Lobby` / `Countdown` | the hero moment: the countdown becomes the rail | none |
| `MeetingScreen` / `MeetingBar` | live line under the title, crossfade on stage swap, calmer bar | none |

## Steps

| # | Step | Done when |
|---|---|---|
| 1 | Tokens and motion primitives (`tokens.ts`, `global.css`) | build and lint clean; every screen still renders |
| 2 | The shell — `AppLayout`, sliding indicator, header | nav works, indicator slides, phone drawer unaffected |
| 3 | The time rail component + `MyMeetings` | a card reads its state without text |
| 4 | The guest landing — `JoinPage`, `Lobby`, `Countdown` | a stranger's first screen looks intentional |
| 5 | In-meeting chrome — title bar, live line, bar, stage crossfade | nothing competes with the video |
| 6 | Admin — `RoomsList`, `RoomForm` | consistent with the rest, tables still scroll on a phone |
| 7 | Pass: 375px, keyboard focus, reduced motion, both themes | the checklist below, verified not assumed |

## Quality floor (verified, not assumed)

375px with no sideways scroll · visible focus ring on every control · `prefers-reduced-motion`
honoured including the antd Drawer · body text ≥4.5:1 and large text ≥3:1 in **both** themes ·
touch targets ≥44px · no emoji as icons · nothing animates `width`/`height`/`top`/`left`.
