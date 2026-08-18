# The meeting whiteboard

- **Date:** 2026-08-18
- **Area:** room (`room-web`, plus one table and two API routes)
- **Branch / commits:** `feat/room-whiteboard`, merged to `main` as `1db29ac`
- **Status:** **live** — api image `e3643c4b`, room-web image `48968b60`.
  **Never opened in a browser.** See Verification.

## Goal

*"use any skill that need and agents to implementation the Whiteboard to room-web"* — the last of the
features [the room service design](../superpowers/specs/2026-07-31-room-service-design.md) deliberately
left out of v1.

Design: [`2026-08-17-room-whiteboard-design.md`](../superpowers/specs/2026-08-17-room-whiteboard-design.md).
Plan: [`2026-08-17-room-whiteboard.md`](../superpowers/plans/2026-08-17-room-whiteboard.md).

## What changed

| | |
|---|---|
| `room-web/src/features/whiteboard/wire.ts` | The sync rules as pure functions — no React, LiveKit or Excalidraw imports. 19 tests. |
| `…/useWhiteboardSync.ts` | Thin glue over the data channel: filter, reconcile, apply. |
| `…/WhiteboardStage.tsx` | Owns Excalidraw. Lazy, so it never enters the entry chunk. |
| `…/BoardBoundary.tsx` | Contains a failed chunk load to the board instead of the meeting. |
| `MeetingScreen.tsx`, `MeetingBar.tsx` | One state field, one swapped element, one toggle. |
| `src/Domain/Rooms/RoomBoard.cs` + config + migration | One row per meeting, scene stored opaque. |
| `src/Application/Rooms/RoomBoard.cs` | Query + command, reusing `RoomChatAccess` unchanged. |
| `src/Web/Endpoints/Rooms/Room.cs` | `GET`/`PUT /api/Room/{id}/board`. |
| `room-web` gains vitest | The first tests this app has ever had. |

## Decisions

- **The pen follows the microphone.** `canDraw` is the token's `canPublish`, and the server-side write
  gate is `Room.MayPublish` — the same predicate. One rule in one place, so the two cannot drift apart,
  and no branch on meeting type exists anywhere in the feature.
- **Inbound edits are trusted by the sender's publish permission**, which the media server attests and a
  peer cannot forge. Sending the presenter's *identity* to clients was the obvious alternative and was
  rejected: for an engineer that identity is their کد ملی, which this service deliberately keeps off the
  wire. Hashing would not have helped — a ten-digit number with a known salt is brute-forced instantly.
- **The old vahedgas implementation was not ported verbatim.** Its peer-snapshot RPC, data-bus class and
  host rebroadcast all exist to solve a problem server-side saving removes — and that is exactly where
  its four bugs live (a "host" that can never be you, a one-shot catch-up with no retry, a leaked RPC
  handler, and chunking that counts characters against a byte limit).
- **Vitest runs in the node environment.** Keeping the rules pure meant no jsdom, no canvas stub and no
  `antd-jalali` stub — four documented traps avoided at no cost.
- **`vitest@3`, not the `^2.1.0` the other apps pin.** vitest 2 depends on vite 5 and this app is on
  vite 6; `analytics-web` lives with that collision behind a `react() as AnyPlugin` cast.

## Verification

**Automated, all green:** `dotnet build src/Web` 0 errors · `RoomBoardTests` **8/8** · room-web
typecheck, `eslint --max-warnings 0`, `vite build`, and **19/19** vitest.

**On production after deploy:**
- Migration `20260818060454_AddRoomBoards` applied; the `RoomBoards` table exists.
- `GET /api/Room/1/board` → **401**, `PUT` → **400** unauthenticated. Routes exist and are gated.
- `index.html` loads `index-DgnxpNIs.js`, which contains **zero** occurrences of "excalidraw". The
  680 KB chunk that does is never referenced by the page, so the guest landing page downloads none of it.

**NOT verified — and this is the important part of this record.** No meeting has ever been held on this
feature. Nobody has opened the board, drawn on it, watched an edit reach another browser, confirmed an
audience member has no tools, or reloaded to see a board come back. Those checks need a signed-in
meeting and were deferred every time. Specifically still owed:

- The RTL drag check on Excalidraw. The `dir="ltr"` wrapper is defensive, from a documented trap; it has
  not been shown to be necessary *or* sufficient in a browser.
- Image paste, which is the path that touches Excalidraw's WASM font code.
- Theme flip repainting the canvas.
- 375 px.
- Two windows drawing at each other — the path that has **never** been observed working in this feature
  area at all, chat included.

## How it was built

Six tasks, each dispatched to a fresh subagent with a task brief, then reviewed by a second one against
the diff. The review loop earned its place: it found an omitted error boundary, a fixture that could not
fail correctly, a dependency pin copied without checking, and a stale import — **every one of them a
defect in the plan rather than in the code an implementer wrote.**

Two agents' processes died mid-flight. The Task 4 implementer had already committed both its own task and
Task 5 before dying and never reported; the ledger at `.superpowers/sdd/progress.md` is what made that
recoverable, and everything it left was re-verified from scratch rather than trusted.

## Follow-ups

- **Hold a real meeting on it.** Everything above is owed.
- **The camera strip.** The design says the cameras become a strip above the board; the plan replaced the
  stage entirely instead, because `MeetingStage` already owns that layout for screen share. Deliberate,
  and flagged rather than dropped.
- **Minor findings banked during review:** the chunk budget counts a comma byte for the first element of
  each chunk (overshoots by ≤1 byte, always safe); `BoardErrorFallback` is exported only to satisfy a
  lint rule that cannot see class components; `BoardBoundary` has no test; a `canDraw` flip mid-debounce
  could publish once with a stale check (harmless — every receiver re-checks live permission).
- **The rate limiter** is unchanged: 120/min per IP, shared. A drawing client costs ~6 saves a minute, so
  the board does not move that needle — but the webinar concern from step 7 still stands.
