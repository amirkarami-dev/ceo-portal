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

## The bug review caught after deploy

The task review ran late (its first attempt died mid-response) and found a **Critical** defect in the
browser half, already on production. It is worth recording in full, because nothing in the automated
gates could have caught it.

`useMutation` returns a **new object on every render**. The "save once on close" cleanup depended on
that object, so it ran after every render rather than at unmount — and `saveTimer.current` was never
cleared after firing, so the cleanup always believed a save was pending. Each save re-rendered the
component, which re-ran the stale cleanup, which saved again: a request loop against the endpoint,
straight into the shared 120-per-minute limit and the 429 the plan warned about by name.

Worse in a meeting: Excalidraw fires `onChange` for **programmatic** scene updates too, so applying a
peer's edit or loading the stored board armed a save on a client that had drawn nothing — and in a
meeting everyone may draw, so that was everyone.

Fixed in `310ef28` (room-web image `9b1b370a`): the flush uses the stable `save.mutate` through a ref
with an empty dependency list, the timer is nulled when it fires, and the save is now armed from the
**result** of `broadcastChanged`, which is true only when this client had local changes — an element
applied from a peer is recorded in `lastVersions` before it reaches the canvas, so it cannot look like
one of ours.

**The lesson worth keeping:** typecheck, lint and 19 passing unit tests were all green through this.
It is effect timing, and the only things that would have caught it are a review that reads the code
or a browser that runs it. The unit tests cover pure functions by design — that decision bought
speed and simplicity, and this is its bill.

## The first-save race, fixed after review

Two clients could both read "this meeting has no board yet" and both insert. The unique index on
`RoomBoards.RoomId` caught the second one — as a `DbUpdateException`, i.e. a 500.

The loser now detaches its failed insert, re-reads the row that won, and updates it. That is an
ordinary save rather than a conflict: last write wins is already this feature's rule, because every
client holds the same merged scene, so either save is a complete board. A missing winner is rethrown,
since that means the insert failed for another reason and swallowing it would hide a real fault.

Note `DbSet.Remove` on an entity still in the `Added` state **detaches** it rather than marking it
deleted — that is what keeps the failed insert out of the retry, and it is reachable through
`IApplicationDbContext`, which exposes the sets but not `Entry()`.

A test now asserts the database really refuses a second board for one meeting. That index is what the
retry depends on, and an in-memory provider would ignore it — the same reason this repo already
insists CHECK constraints are tested against real SQL Server. **The catch path itself is not covered**:
making the row appear between the handler's read and its insert needs a hook the code does not have,
and a test that cannot fail is worse than an honest gap. 9/9 pass.

The review's other finding — an unused `using` in the test file — **was wrong**. `EngineerInfo` comes
from that namespace, and removing it broke the build immediately.

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
