# Room step 7: the link landing page and the countdown

- **Date:** 2026-07-31
- **Area:** room / front end
- **Branch / commits:** `main` — uncommitted at time of writing
- **Status:** **proven in a browser, end to end** — a guest opened a link, waited out the countdown,
  and got in with the right token

## Goal

Step 7's success criterion: **a guest opens a link and waits, then joins**.

## What changed

- `room-web/src/features/join/JoinPage.tsx` — `/j/:joinToken`, outside `RequireAuth` **and** outside
  `AppLayout`.
- `room-web/src/features/join/Countdown.tsx` — the countdown, corrected against the server's clock.
- `room-web/src/features/join/Lobby.tsx` — what a person sees the moment they are let in.
- `useRoomLanding` / `useJoinByLink` in `lib/queries.ts`; `RoomLanding` / `RoomJoinResult` in `types.ts`.
- `src/Web/appsettings.Development.json` — a throwaway **local** LiveKit key pair. With it empty the
  token service reports unconfigured and every join answers «سرویس ویدیو در دسترس نیست», so no room
  screen could be developed or tested locally at all. Tokens signed with it are valid JWTs the real
  media server will refuse, which is exactly right.

## Decisions

- **The countdown is measured against the server's clock, not the device's.** The landing DTO already
  carried `serverNowUtc` for this. The remaining time is computed once as `target − serverNow`,
  converted to a local deadline, and counted down from there: a local clock is unreliable for *what
  time it is* but perfectly good at measuring *how much time has passed*. A laptop an hour out —
  common on a machine that has been asleep — would otherwise count down to the wrong moment, or
  straight past it.
- **The clock decides only when to re-ask.** `onElapsed` invalidates the landing query and the
  server's own `canJoinNow` wins. The browser never decides that a meeting is open.
- **The name box is shown while the countdown runs**, so nothing is left to type at the moment the
  door opens.
- **The page is standalone** — no sidebar, no app menu, no user chip, even for a signed-in visitor.
  This is the first thing an outside guest ever sees of the organisation, and they arrived from a chat
  message, not from the app.
- **A private link offers sign-in and no countdown.** The obstacle is the account, not the clock, and
  the return URL is stored first so the IdP round trip comes back to the meeting rather than the home
  page — otherwise the guest has to find the link again in whatever chat it arrived in.
- **`Lobby` is a real screen, not a placeholder.** Every gate has passed and a token has been minted,
  so what it confirms is true: the meeting, the name others will see, and whether they may speak. Step
  8 adds the video below it.

## Four bugs, three of them found by looking at the running page

### 1. A closed meeting showed a countdown frozen at ۰۰:۰۰:۰۰
The branch was «not joinable and not a sign-in case → countdown», which swept up *closed*, *full* and
*not invited* along with *too early*. A timer reading zero forever looks like a broken page and tells
somebody to keep waiting for something that will never happen. Now the countdown appears only when
`opensAtUtc` is genuinely still ahead of `serverNowUtc`; every other refusal shows its reason and **no
button at all** — an offer that cannot be accepted is worse than no offer.

### 2. The countdown leaked one DOM node per second
Every past digit was still in the page: ۵۳, ۵۱, ۵۰, ۴۹ … stacked in one tile. `AnimatePresence` will
not remove an element until its `exit` animation completes, and that is driven by
`requestAnimationFrame`, which browsers **pause for a tab that is not visible**. This page is designed
to sit open for twenty minutes while somebody waits for a webinar, so the background tab is the normal
case — about 1200 orphaned nodes by the time they come back. Fixed by animating the **arrival only**:
a keyed `motion.span` with no `AnimatePresence`, so changing the key replaces the node and there is no
exit lifecycle to stall.

### 3. A 429 told the guest their meeting did not exist
The API has a global rate limiter — **120 requests per minute, partitioned by client IP** — and the
landing page reported *any* failure as «این جلسه پیدا نشد». That sends somebody whose link is perfectly
good off to ask for a new one, which will behave exactly the same. Now 404 is the only thing that reads
as "not found"; 429 and 5xx say the link is fine, the problem is temporary, and offer **تلاش دوباره**.

### 4. A throttled join destroyed the page
`onError` on the join mutation refetched the landing unconditionally. When the failure was a 429, that
refetch was throttled too — so one rate-limited button press replaced the meeting the guest was looking
at with a full-page error. The refetch now runs only for a genuine refusal (the door state changed
under us), never for a transient one.

## Verification — a guest really did open a link and join

Four meetings were seeded straight into the local database (`ceo-t7*`) to exercise every branch, and
each was driven in a real browser at `http://room.localhost:5277`:

| Link | Shows |
|---|---|
| public, already open | name box + live «ورود به جلسه» + the audience note |
| public, opens in 40s | countdown ticking, name box, disabled button |
| private, open | «فقط برای اعضای سازمان است» + sign-in button, **no countdown, no name box** |
| public, closed by an admin | «این جلسه بسته شده است» and nothing else |

**The criterion itself:** on the third link the countdown ran down, and at zero the page **swapped
itself over with no reload** — the digit tiles disappeared and the button became «ورود به جلسه». A name
was typed and the join went through:

> **به جلسه وارد شدید** · نام شما در جلسه: **رضا احمدی** `مهمان` · اجازهٔ صحبت: **فقط تماشا و گفتگوی متنی**

And the token behind that screen was decoded from the response to check it agrees:

```json
{ "sub": "guest-39c1c7ecb29c031d",
  "video": { "room": "ceo-t7soon", "roomJoin": true,
             "canPublish": false, "canSubscribe": true, "canPublishData": true } }
```

`canPublish` present and **false** — the flag LiveKit reads as *true* when omitted — scoped to one
room, no admin grants, and `canPublishData` true so chat will still work. The screen and the token say
the same thing.

Also: `npm run build` + `npm run lint --max-warnings 0` clean; unit **326 passed**; functional **130
passed / 3 failed** (the same three pre-existing failures from `2026-07-30-election-voter-flow.md`).

**One thing was not driven by a real mouse.** With the Browser pane hidden the automation's synthetic
clicks stopped reaching React entirely — the theme toggle would not flip either — so the final button
press was dispatched as a real bubbling `MouseEvent` through the element's own `.click()`. That runs
the actual React `onClick`, not a bypass, and typing was real keystrokes throughout. Worth knowing the
distinction; worth re-checking with a physical click.

## Follow-ups — one worth acting on before a public webinar

- **The rate limiter is per-IP and a public link is exactly the case where people share one.** 120
  requests per minute per IP is generous for one person and tight for an office, a campus, or a mobile
  carrier's NAT all opening the same webinar link in the same minute — each guest costs one landing GET
  plus one join POST, so ~60 guests behind one address is the ceiling. This is a **whole-API** control
  (`src/Web/DependencyInjection.cs`), shared with mabhas19, analytics, walfare and election, so it is
  flagged rather than changed here. The scoped fix would be to give the two anonymous `/api/Room/j/*`
  routes their own partition with a higher budget, leaving every other route as it is.
- Step 8: `/room/:id`, the meeting screen, and the «ورود» button on «جلسات من» that opens it. `Lobby`
  becomes its pre-join panel.
- The four `ceo-t7*` rooms are still in the local database, so the links above can be clicked by hand.
  Delete with `DELETE FROM Rooms WHERE Slug LIKE 'ceo-t7%'`.
