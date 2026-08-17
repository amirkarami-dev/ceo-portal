# Room whiteboard — design

- **Date:** 2026-08-17
- **Area:** room (`room-web`, plus two API routes and one table)
- **Status:** design approved in conversation; no code written
- **Follows:** [the room service design](2026-07-31-room-service-design.md), which listed the whiteboard
  under *"deliberately not in v1"*

## 1. What this adds

A shared drawing board inside a meeting. Everyone sees the same board; who may draw depends on the
meeting type. The board is saved, so it survives a reload, a late joiner, and the meeting ending.

The implementation is Excalidraw, taking the proven parts of the version in
`C:\Projects\vahedgas\vahedgas-portal\vnext\room-web` and leaving its peer-to-peer catch-up machinery
behind — see §3.

## 2. Decisions

| # | Question | Answer |
|---|---|---|
| 1 | Who may draw? | **Meeting: everyone. Presentation: the presenter only.** |
| 2 | How strongly is that enforced? | **Every browser checks who sent each edit** and drops the rest. |
| 3 | Does the drawing survive? | **Yes — saved on the server, in batches.** |
| 4 | Scope of this pass | **The whiteboard alone**, with Excalidraw's full toolset. |

Not in this pass, and not implied by it: PDF co-viewing, reactions, raise-hand, recording, live
pointer/cursor sharing, more than one board per room, per-shape locking, and any "grant the pen"
handoff.

## 3. Why not port the old code as it stands

The old implementation works, but three of its parts exist only to solve a problem this design does
not have, and four are outright broken. Both lists come from a full read of it.

**Made unnecessary by decision 3.** With the board on the server, a late joiner reads it from the API.
So the peer snapshot RPC (`wb.snapshot`), the `RoomDataBus` class that wraps it, and the ten-second
host rebroadcast all go.

**Broken, and worth knowing about so we do not re-create it.**

| what | why it matters |
|---|---|
| `isHost` can never be true — the parent computes the "host" from **remote** participants, then the component compares it with the local identity | the clear-board button never renders for anyone, and the rebroadcast safety net never starts |
| the snapshot request fires once, guarded by a ref, and never retries | first to open the board ⇒ blank board forever, because the fallback above is dead |
| the RPC handler is registered and never unregistered | it answers later snapshot requests with a scene from a closed tab |
| chunking counts **characters** against a byte limit | Persian text is two bytes per character, so a payload it believes is 14 KB can exceed 20 KB and be dropped with no error |

What we do keep, because it is sound: send only the shapes whose `version` changed; split large
payloads; let Excalidraw's own `reconcileElements` settle conflicts; load the editor lazily in two
stages so it never lands in the main bundle.

## 4. Where it lives on screen

The board **takes the stage**, and the camera tiles become a strip above it — structurally identical
to how a screen share already behaves (`MeetingStage.tsx:49-63`).

Not the side drawer. That drawer is `width={340}` (`MeetingScreen.tsx:160`), and the old project
refused it for the same reason: a 340 px board is a thumbnail.

A circle button in the bottom bar toggles it, beside the participants button, using that bar's
existing `Tooltip` + `Button shape="circle"` pattern (`MeetingBar.tsx:101-118`).

## 5. The units, and what each is responsible for

```
MeetingScreen.tsx ── one piece of state, one swapped element, one button
      └── WhiteboardStage.tsx ── owns the canvas; loads Excalidraw lazily
              ├── useWhiteboardSync.ts ── sends my changes, applies theirs
              └── useRoomBoard (queries.ts) ── loads the saved board, saves in batches
```

### `WhiteboardStage.tsx`

```ts
function WhiteboardStage(props: {
  roomId: number
  canDraw: boolean   // may I draw at all
}): JSX.Element
```

It does **not** take the meeting type. The filter in §7 turns out to be the same rule for both types,
so there is nothing to branch on — a parameter that would only ever be read to reach the same answer.

Owns the Excalidraw instance and nothing else. Reads the theme from `useThemeMode()`. Fills its
parent; the parent gives it a bounded box.

### `useWhiteboardSync.ts`

```ts
function useWhiteboardSync(
  api: ExcalidrawImperativeAPI | null,
  opts: { canDraw: boolean },
): {
  broadcast: (elements: readonly ExcalidrawElement[]) => void  // deltas, debounced by the caller
  broadcastFull: (elements: readonly ExcalidrawElement[]) => void
}
```

Subscribes to the whiteboard topic on the existing data channel, filters, reconciles, applies. Knows
nothing about the API or about Excalidraw's UI. This is the unit the tests target.

### `useRoomBoard` — in `lib/queries.ts`, beside the chat pair

```ts
function useRoomBoard(roomId: number, enabled: boolean): UseQueryResult<RoomBoard | null>
function useSaveRoomBoard(roomId: number): UseMutationResult<void, Error, { scene: string }>
```

`staleTime: Infinity`, exactly like chat history (`queries.ts:169-176`): the board is fetched once and
kept current by the live channel, never polled.

## 6. The wire protocol

One topic, one message shape, following the `kind` convention already used for chat
(`types.ts:233-241`):

```ts
interface WhiteboardWireMessage {
  kind: "whiteboard"
  elements: ExcalidrawElement[]   // only the shapes whose version changed
}
```

- **Debounce:** 150 ms after the last change.
- **Delta selection:** a `Map<id, version>` of what we last sent; send only what differs; record what
  we receive too, so an applied remote shape does not bounce back.
- **Chunking:** split so each published message stays under 12 KB **measured with `TextEncoder`**, not
  by string length, and count the JSON envelope. A single shape larger than the limit is sent alone
  and logged as oversized rather than silently dropped.
- **Reliability:** `{ reliable: true }`. A lost delta would leave two people looking at different
  boards, and there is no periodic full rebroadcast to repair it.
- **Late arrivals:** when a participant joins, any client that may draw sends one full scene
  (debounced, once per join). This replaces the old ten-second timer: it fires exactly when it is
  needed and never otherwise.

Every inbound message is treated as hostile: check `kind`, check the sender (§7), check that
`elements` is an array, and ignore anything else silently — the boundary rule already documented for
chat (`ChatPanel.tsx:62-65`).

## 7. Permissions

### May I draw?

`canDraw = joinResult.canPublish`.

That boolean comes off the join token and already means exactly what decision 1 asks for: true for
everyone in a `Meeting`, true only for the presenter in a `Presentation`
(`Room.MayPublish`, `Room.cs:122-127`). The pen therefore follows the microphone, with no second
permission model to keep in step.

When it is false, Excalidraw mounts with `viewModeEnabled`. The audience sees the drawing arrive and
has no tools at all — matching the existing choice that publish controls are **absent, not disabled**
(`MeetingBar.tsx:14-18`).

### Whose edits do I believe?

The media server tells every browser each participant's publish permission, and a peer cannot forge
another peer's permissions. The app already reads it to label who may speak
(`ParticipantsPanel.tsx:46` — `p.permissions?.canPublish`).

So: **accept an edit only if the sending participant may publish.**

```
presentation ⇒ only the presenter may publish ⇒ only the presenter's edits apply
meeting      ⇒ everyone may publish          ⇒ everyone's edits apply
```

Note there is **no branch on meeting type**. One rule produces both behaviours, because the token
already encodes the difference. Code that asked "is this a presentation?" would only be re-deriving
what the permission flag already says.

`msg.from.identity` identifies the sender; the participant is looked up in the room state and its
`permissions.canPublish` decides. If the participant or its permissions are not known yet, the edit is
dropped — the join-time full broadcast repairs the gap.

**Why not send the presenter's identity to the client.** Because for an engineer account the identity
*is* the کد ملی (`RoomJoining.cs:64-69`), and this service deliberately keeps it off the wire — the
landing DTO's own comment reads *"No identifiers of any kind. No room id, no slug, no invite list, no
presenter کد ملی"* (`RoomAttendeeQueries.cs:12-18`). Hashing it would not help: a ten-digit number with
a known salt is brute-forced instantly. The permission flag carries the same authority with no
identifier attached, and needs no new field.

**What this does not stop.** A determined audience member can still *publish* whiteboard bytes — their
token grants `canPublishData: true`, which is a single all-or-nothing flag with no per-topic form
(`RoomTokenService.cs:88-99`), and turning it off would also kill their chat. Nobody applies those
bytes, and nothing they send can be saved (§8). That is the honest boundary: we cannot stop the
shouting, only make sure no one is listening.

## 8. Saving

| when | request |
|---|---|
| board opened | one `GET` |
| drawing | none — the channel carries it |
| 10 s after **my** last change | one `PUT`, the whole scene — a debounce, not a repeating timer, so a still board sends nothing |
| board closed, or I leave | one final `PUT` |

**Only a client that actually drew saves**, not every participant. Three people sketching costs about
18 requests a minute against the shared 120-per-minute-per-IP budget
(`DependencyInjection.cs:62-79`); a meeting where nobody draws costs nothing. Nothing polls.

**Last write wins, and that is safe here.** Every client converges on the same scene through
`reconcileElements`, so any drawer's snapshot is a complete, valid board rather than a partial view.

**A 429 must be handled explicitly**, and must never be reported as "not found" — the mistake made
once on the join page (`docs/worklog/2026-07-31-room-step-7-join-page.md:65`). A failed save is
retried on the next tick and never blocks drawing.

### The server side

**One new table, `RoomBoards`** — one board per room:

| column | type | notes |
|---|---|---|
| `RoomId` | int, PK, FK → `Rooms`, cascade delete | one board per room |
| `Scene` | `nvarchar(max)` | **an opaque string.** A typed DTO silently drops every field it does not declare (`docs/ai/GOTCHAS.md:1310`), and an Excalidraw scene is a large, evolving shape |
| `UpdatedUtc` | `datetime2` | |
| `UpdatedBy` | `nvarchar(256)` | the saver's identity, for the same reason chat records its sender. **Server-side only — never returned by the read route**, because that identity can be a کد ملی (§7) |

**Two routes**, in the attendee group beside the chat routes:

```
GET  /api/Room/{roomId}/board     → { scene, updatedUtc } | null
PUT  /api/Room/{roomId}/board     ← { scene }
```

- **Authorisation reuses `RoomChatAccess.ResolveAsync`** (`RoomChat.cs:43-95`) unchanged: a signed-in
  member is re-checked against the join rules, a guest is authenticated by their room token, and a
  token minted for one meeting is worthless for another. No new auth path is written.
- **The write gate is `room.MayPublish(identity)`** — the same call that decides the microphone. One
  rule, one place; the pen cannot drift from the mic.
- **A closed meeting stays readable and takes no saves**, matching chat (`RoomChat.cs:169-172`).
- **Size cap: 2 MB** of scene JSON, **rejected rather than truncated** (a truncated scene is corrupt,
  where a truncated chat line is merely short), plus a matching `RequestSizeLimit` on the route. 2 MB
  is roughly a very full board of shapes and text; a pasted photograph is what exceeds it, and that is
  the case worth refusing loudly. The client surfaces the refusal instead of retrying forever.
- **Handler names are area-prefixed** — `GetRoomBoard`, `SaveRoomBoard`. Two handlers sharing a method
  name once made the *entire* API return 500, including routes nobody had touched
  (`docs/ai/GOTCHAS.md:119`).

## 9. Traps this codebase has already paid for

| trap | reference | what we do |
|---|---|---|
| A library that positions children with `transform` and never writes `left` breaks under `dir="rtl"`, and the error **doubles** on drag | `GOTCHAS.md:1027` | Run the documented check on Excalidraw **before** writing code: `getComputedStyle(item).left` must be `0px` and the offset must equal the transform X. If it fails, the canvas container becomes `dir="ltr"` — a drawing surface has no reading direction, and Persian text inside it still shapes correctly |
| `process is not defined` killed a drag library here, with a clean console | `GOTCHAS.md:525` | `globalThis.process ??= { env: {} }` at the entry **plus** a Vite `define`, before Excalidraw is imported. room-web has no shim today |
| The blanket `prefers-reduced-motion` rule crushes every transition, and parks an antd Drawer off-screen | `GOTCHAS.md:507`, `global.css:83` | The board is on the stage, not in a Drawer, so the parked-drawer bug does not apply. No CSS transition may be load-bearing for showing it — conditional rendering only |
| A canvas theme binds at init; ours has a live light/dark toggle | `GOTCHAS.md:1163` | Pass the mode to Excalidraw, read the background from `token.colorBgContainer` (the old code hard-codes `#1e1e1e`), and check the canvas repaints on flip |
| `/assets/` is immutable with a hard 404; a miss **outside** it silently returns `index.html` with a 200 | `room-web/deploy/nginx.conf` | Confirm Excalidraw's fonts and locale chunks are emitted under `/assets/`, and fetch one real URL in production |
| The image installs with `--legacy-peer-deps`, which also skips *installing* peers — it builds locally and dies in Docker | `GOTCHAS.md:775` | Declare every peer the code imports explicitly in `room-web/package.json` |
| jsdom has no canvas context and reports every element 0×0 | `GOTCHAS.md:494` | Tests never import Excalidraw; they exercise the sync logic against a fake channel |
| A dynamic `import()` inside a test charges that test for the whole module graph | `GOTCHAS.md:764` | Same answer: no Excalidraw in tests |
| `antd-jalali` breaks under Vitest and cannot be fixed by aliasing | `GOTCHAS.md:787` | Stub it in `vitest.setup.ts` when standing vitest up in this app |
| The Vite dev server can serve a stale transform that looks exactly like a real bug | `GOTCHAS.md:1281` | Confirm with a cache-busted fetch and restart the server before believing a symptom |
| `AppSwitcher.tsx` is byte-identical across eight SPAs | `GOTCHAS.md:754` | This feature must not touch it |
| Bundle: Excalidraw drags in mermaid, katex and cytoscape | — | Two-stage lazy load. Compare the entry chunk before and after; the guest landing page must download none of it |

## 10. What we accept, openly

- **A canvas is invisible to a screen reader** (`GOTCHAS.md:1361`). A chart can carry a hidden table of
  its numbers; a freeform drawing cannot. The canvas is `aria-hidden`, the toggle button is labelled,
  and this limitation is recorded rather than papered over.
- **Text typed into the board is not sanitised.** Chat strips bidi overrides while sparing U+200C
  (`docs/worklog/2026-07-31-room-step-9-chat.md:72`); doing the same inside an opaque scene blob would
  mean parsing and rewriting it on the server. A hostile override inside a board label affects the
  rendering of that label, drawn by someone already trusted to draw. Noted, not fixed.
- **Last write wins** on the saved board (§8).
- **We cannot stop an audience member publishing bytes**, only ensure nobody applies them (§7).

## 11. Verification

The bar this repo sets: build and lint clean, plus an **observed** run — both room worklogs report
exact test counts *and* a browser session.

- `npm run build` (type-checks both configs) and `npm run lint` with `--max-warnings 0`.
- **First tests in `room-web`.** Vitest, covering `useWhiteboardSync` only: which shapes are sent,
  byte-accurate chunking, the sender-permission filter, and rejecting junk on the topic. A fake data
  channel; no Excalidraw import.
- Backend functional tests beside `RoomChatTests`: a token for another room is refused; an audience
  member in a presentation cannot save; the presenter can; a closed room reads but does not write; an
  oversized scene is refused.
- **Two windows, watched:** draw in one and see it in the other; the audience has no tools; a reload
  restores the board; a late joiner receives it; the theme toggle repaints it; a phone-width viewport
  is usable.

That last one carries extra weight: **live delivery between two participants has never been observed
in this feature area at all** — not for the whiteboard, not for chat
(`docs/worklog/2026-07-31-room-step-9-chat.md:117`).

## 12. Build order

Each step ends in something checkable on its own.

| # | Step | Done when |
|---|---|---|
| 1 | Prerequisites: the `process` shim, the RTL check on Excalidraw, declared deps | the board renders at all, dragging does not double its offset |
| 2 | `RoomBoards` table, the two routes, backend tests | the five backend cases pass on the server |
| 3 | Vitest in `room-web` + `useWhiteboardSync` with its tests | deltas, chunking and the filter are proven without a browser |
| 4 | `WhiteboardStage` with lazy Excalidraw, read-only when `canDraw` is false | a board draws locally; an audience member has no tools |
| 5 | The `MeetingScreen` seam and the bar button | the board takes the stage, cameras become a strip |
| 6 | Load and save wiring, plus the full broadcast on join | reload restores; a late joiner catches up |
| 7 | Phone width, theme flip, entry-chunk comparison | usable at 375 px; repaints on flip; entry chunk unchanged |
| 8 | Two-window observed run | one person draws, another sees it |
| 9 | Deploy `room-web` (and `api` for step 2), then the worklog | live, with the record written |
