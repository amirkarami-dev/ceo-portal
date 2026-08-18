# room-web redesign — visual and motion language

- **Date:** 2026-08-18
- **Area:** web (room-web)
- **Branch / commits:** `main` — not committed at time of writing
- **Status:** **live** at room.myceo.ir — signed-in screens still unseen in a browser

## Goal

> «redesign the @room-web as modern UI with best method / you can use motion and animate /
> note: keep the logic»

Seven numbered steps, agreed up front in
[`docs/design/2026-08-18-room-web-redesign.md`](../design/2026-08-18-room-web-redesign.md), each
started on the user's word. Presentation only — no route, query, permission or media logic changed.

## What changed

| File | What and why |
|---|---|
| `src/theme/tokens.ts` | Palette rebuilt on the estate's own six brand colours. Two different reds on purpose: `#FD411E` = on air, `#E5484D` = failed. `controlHeightLG: 44`. `colorBgContainer` / `colorBgElevated` / `colorTextSecondary` / `colorTextDescription` pointed at the palette — see Root cause. New `phaseColor()` and `withAlpha()`. Deleted `toneColor`, `toneSurface`, `chartColors`: no callers, no charting dependency, inherited with the file. |
| `src/theme/global.css` | The token layer — colour, three elevation steps, radius and motion scales, both themes. Tabular numerals app-wide. Nav, rail, chip, countdown, meeting and form-action rules. |
| `src/theme/motion.ts` | New. The CSS motion scale in seconds for framer-motion, plus `useEnter`, `useListMotion`, `usePressable`. |
| `src/lib/schedule.ts` + `.test.ts` | New, pure, 8 tests. Phase, rail fill and Persian relative time. |
| `src/lib/useNow.ts` | New. A ticking clock, because react-query's structural sharing means a refetch that changes nothing never re-renders. |
| `src/components/TimeRail.tsx`, `PhaseChip.tsx` | New. The signature device and its label. |
| `src/components/PageHeader.tsx` | Page title was `h4` with nothing above it; now `h1`, sized by hand. |
| `src/layout/AppLayout.tsx` | AntD `Menu` replaced by a hand-built nav so the active marker can be one `layoutId` element that slides. Sider is an overlay on a phone. `collapsedWidth` 0 → 76 on desktop. Glass header. |
| `src/features/meetings/MyMeetings.tsx` | Time rail, one phase chip in place of three status tags, relative time, neutral type/presenter tags. |
| `src/features/join/*` | Countdown at display scale, `sr-only` alternative, reduce-motion guard. Shell wash moved off a hardcoded indigo. Lobby copy fixed. |
| `src/features/meeting/MeetingScreen.tsx`, `MeetingBar.tsx` | Forced dark in both themes. Elapsed clock. Stage crossfade. Bar fits a phone. |
| `src/features/rooms/RoomsList.tsx`, `RoomForm.tsx`, `lib/types.ts` | Schedule chip in the time column. Only the public-link tag stays coloured. Save button full width on a phone. |
| `src/auth/routes.tsx` | The login screen still carried the **pre-redesign** palette — see Root cause. |

## Root cause (the defects this uncovered)

Nothing here was reported as a bug; all six were found by measuring rather than looking.

1. **AntD's secondary text fails AA in light mode.** `colorTextSecondary` is 45% black, which
   measures **3.36:1** on a white card — under 4.5. On dark it is 4.50:1, passing with nothing to
   spare. It is used by every subtitle, card meta row and form hint in the app. Now set from the
   palette: 5.72:1 light, 7.57:1 dark. `colorTextDescription` (a `Form.Item`'s `extra`) does **not**
   follow `colorTextSecondary` and had to be set separately.
2. **AntD's focus ring is invisible on dark.** `.ant-btn:focus-visible` uses `colorPrimaryBorder`,
   which the dark algorithm derives as `#1D2E5A` on a near-black ground. It also outranks an
   unqualified selector, so our rule was losing silently. Now `!important`, measured at 8.14:1.
3. **The dark card was neutral grey.** AntD's dark algorithm paints containers `#141414` while the
   ground and tiles were blue-biased — two dark themes on one screen.
4. **A borderless AntD Card's box-shadow cannot be overridden by a class.** It sets its own from a
   rule that outranks one class, and AntD injects its stylesheet *after* ours, so a specificity tie
   loses too. Set inline.
5. **The meeting screen followed the app theme.** `@livekit/components-styles` is dark by its own
   stylesheet, so light theme wrapped **white chrome around a dark video grid**.
6. **The login screen kept the old palette.** It carried a private copy of the landing wash in the
   previous brand blue (`rgba(37,99,235)`) over the old grounds, so it stayed on the pre-redesign
   look after every other surface had moved. It now shares `.room-join-shell`.

Separately, and **not fixed** — flagged as its own task: `Room.IsOpenAt` (`src/Domain/Rooms/Room.cs:113`)
is `now >= OpensAtUtc` with no upper bound, and `GetMyRoomsQuery` has no date filter, so a meeting
from last month arrives with `canJoinNow: true`. The list used to call it «در حال برگزاری».

## Decisions

- **Live vs joinable are two questions.** `canJoinNow` stays the server's word and still drives the
  join button; "is it now?" is read off the schedule in `lib/schedule.ts`. Both can be true at once —
  the meeting's time has passed and the door happens to still be open.
- **Two reds.** In a video product red means "on air"; using one red for both would make "you are
  live" and "this broke" the same signal. Both always carry an icon and a word.
- **The meeting is dark in both themes**, via a nested `ConfigProvider` for AntD and `.room-meeting`
  joining the existing dark selector list for everything hand-written.
- **No `<AnimatePresence>` anywhere.** An exit animation must finish before its node is removed and
  runs on `requestAnimationFrame`, which a background tab pauses. Established for `Countdown`; the
  stage crossfade follows the same rule.
- **Two planned ideas were dropped after contact with the data**, and the design doc records both:
  the countdown-as-rail (a landing page has nothing to compare against, and a progress bar there
  needs an origin the data does not supply) and the in-meeting progress line (`RoomJoinResult`
  carries no start time and no duration — it became an elapsed clock instead).
- **Chip tint is 0.09, not 0.12.** The text sits on a tint of its own colour; at 0.12 the quietest
  phase measured 4.43:1 on dark. At 0.09 the worst of eight phase/theme combinations is 4.64:1.

## Verification

- `npm run build` (typecheck + vite), `npm run lint --max-warnings 0`, `npm test` — **27 tests pass**
  (19 whiteboard wire + 8 new schedule).
- Rendered end to end in the browser — landing → lobby → meeting — against a throwaway stub API in
  the scratchpad (stopped afterwards). Both themes, 1565px and 375px.
- Contrast measured by compositing over the real background, not eyeballed: phase colours 5.13–12.84
  across both themes, nav 5.50–7.57, countdown digits 13.89/16.12, meeting title 15.55.
- Touch targets: every focusable control now ≥44px, counting the `.room-tap` hit area.
- No horizontal scroll at 375px on any reachable screen; heading outline is a single `h1` per page.
- Static: no animation of `width`/`height`/`top`/`left` anywhere, no emoji used as icons.

**Not verified.** The local IdP refuses connections, so every signed-in screen is unseen in a
browser: the app shell and its sliding nav pill, the meetings list, both admin screens. The connected
meeting is also unseen — the bar, elapsed clock, stage crossfade and drawer need a real LiveKit
server; only the title bar and the failure path were rendered. Screenshots were never available in
this session (the Browser pane would not composite), so all of the above is measurement, not
pictures.

**Deployed 2026-08-18.** Incremental: 20 changed files packaged and copied up, `build room-web` run as
its own step (`BUILD_EXIT=0`), then `up -d --no-deps --force-recreate room-web`. Bundle hash moved
`index-CtDDtbnO.js` → `index-Drz7dpdD.js` (2,315,419 bytes), and the new bundle was grepped rather
than trusted: `room-nav-pill` 1, `room-join-shell` 2, `room-meeting` 2, `room-tap` 2, the new copy
«آمادهٔ ورود هستید» and «زمان آن گذشته است» present, and the removed `mun-live-dot` at 0. `#326bfc`
is in the served CSS. Checked again over the real domain through the CDN: `h1` at weight 700, 44px
primary button, tabular numerals, no horizontal scroll. The unfinished `assessment-core` work could
not ride along — `Dockerfile.room-web` copies only `room-web/`.

## Follow-ups

- Sign in and check the shell, meetings list and admin screens; then a real meeting for the bar,
  the elapsed clock and the crossfade.
- Confirm the collapsed sider's tooltips: `placement="left"` is physically correct for an RTL sider
  on the right, but AntD may mirror placements under RTL. Its overflow adjustment should correct it
  either way — unconfirmed.
- `THEME_STORAGE_KEY` is still `"mun-sanandaj.theme"`. Renaming it resets everyone's saved theme
  once, so it was left alone.
- Deploy, then re-check on the real domain.
