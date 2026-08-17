# Room Whiteboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shared Excalidraw whiteboard to a meeting in `room-web`, where drawing rights follow the microphone, every browser drops edits from anyone not allowed to draw, and the board is saved server-side so it survives a reload, a late joiner and the meeting ending.

**Architecture:** The board replaces the video grid on the meeting stage (cameras demote to a strip above it), reached by one toggle in the bottom bar. Live edits travel over the LiveKit data channel already used by chat, on their own topic, as version-deltas. Durability comes from two new API routes and one new table, written in batches by whoever is drawing. The sync rules live in a pure module with no React, LiveKit or Excalidraw imports, which is what the unit tests exercise.

**Tech Stack:** Vite 6 + React 19 + antd 5 + `@livekit/components-react` 2.9 + `@excalidraw/excalidraw` 0.18.1 (front end); .NET 10, EF Core 10, MediatR, SQL Server (back end); Vitest 2 (node environment) for the new tests.

**Design spec:** [`docs/superpowers/specs/2026-08-17-room-whiteboard-design.md`](../specs/2026-08-17-room-whiteboard-design.md) — read §7 (permissions) and §9 (traps) before Task 1.

## Global Constraints

- **`room-web` installs with `npm install --legacy-peer-deps`** (`AGENTS.md:96`) — `antd-jalali` declares React 18, the app is React 19. The Docker image does the same with `room-web/package.json` alone, so any peer the code imports must be a declared dependency. Excalidraw 0.18.1's only peers are `react` and `react-dom`, both already direct dependencies — verified against the registry, nothing new to declare.
- **Dev port 5277, `strictPort: true`** — never change it. The IdP redirect URI and the API CORS entry are keyed to it (`AGENTS.md:99`).
- **Before shipping: `npm run build` AND `npm run lint` must pass** (`AGENTS.md:104`). `build` runs `tsc --noEmit` over both tsconfigs; `lint` is `eslint . --max-warnings 0`, so one warning fails the build. `tsconfig.json` has `strict`, `noUnusedLocals`, `noUnusedParameters`.
- **.NET builds and tests run on the server**, inside the SDK container with the cached NuGet volume (`docs/ai/OPERATIONS.md:11`). Try locally first; if *restore* fails, fall back to the server.
- **UI text is Persian**, inline, no i18n layer. Every interactive control gets a Persian `aria-label` and a `Tooltip`.
- **RTL:** the app is `dir="rtl"` globally. Use logical CSS properties (`insetInlineStart`, `paddingInlineEnd`, `textAlign: "start"`), never `left`/`right`.
- **Styling is inline `style` + `theme.useToken()`.** No CSS modules, no Tailwind. Never hard-code a colour that has a token.
- **Enums are numbers on the wire** (`room-web/src/lib/types.ts:1-15`). `RoomType.Presentation` is `1`, never `"Presentation"`.
- **`src/layout/AppSwitcher.tsx` is byte-identical across eight SPAs** (`docs/ai/GOTCHAS.md:754`). This feature must not touch it.
- **A task is not finished until `docs/worklog/YYYY-MM-DD-<slug>.md` exists** and is indexed (`AGENTS.md:16`). That is Task 6.
- **Don't run all the dev servers.** For this work: `docker start ceo-livekit-local`, then auth (5100), api (5000), room-web (5277) and nothing else (`AGENTS.md:130`).

## File Structure

| File | Responsibility |
|---|---|
| `room-web/src/features/whiteboard/wire.ts` **(new)** | Pure sync rules: delta selection, byte-accurate chunking, message decode + validation, sender check. No React/LiveKit/Excalidraw imports. |
| `room-web/src/features/whiteboard/wire.test.ts` **(new)** | Tests for the above. The only tests in this app. |
| `room-web/src/features/whiteboard/useWhiteboardSync.ts` **(new)** | Thin glue: subscribes to the data channel, filters through `wire.ts`, hands remote elements to its caller. |
| `room-web/src/features/whiteboard/WhiteboardStage.tsx` **(new)** | Owns the Excalidraw instance, the debounces, and load/save. Lazy-loaded, so Excalidraw never enters the entry chunk. |
| `room-web/src/features/meeting/MeetingScreen.tsx` | +1 state field, +1 lazy import, stage swap, 2 props to the bar. |
| `room-web/src/features/meeting/MeetingBar.tsx` | +2 props, +1 toggle button. |
| `room-web/src/lib/types.ts` | + `RoomBoard` DTO. |
| `room-web/src/lib/queries.ts` | + `useRoomBoard`, `useSaveRoomBoard`. |
| `room-web/vite.config.ts`, `room-web/package.json`, `room-web/vitest.setup.ts` **(new)** | Vitest, node environment. |
| `src/Domain/Rooms/RoomBoard.cs` **(new)** | The entity. |
| `src/Infrastructure/Data/Configurations/Rooms/RoomConfigurations.cs` | + `RoomBoardConfiguration`. |
| `src/Application/Common/Interfaces/IApplicationDbContext.cs`, `src/Infrastructure/Data/ApplicationDbContext.cs` | + one `DbSet`. |
| `src/Application/Rooms/RoomBoard.cs` **(new)** | DTO, query, command, size rule. Reuses `RoomChatAccess`. |
| `src/Web/Endpoints/Rooms/Room.cs` | +2 routes, +2 handlers. |
| `tests/Application.FunctionalTests/Rooms/RoomBoardTests.cs` **(new)** | Six backend cases. |

---

### Task 1: A board on the meeting stage

Deliverable: in a real meeting, a button opens an Excalidraw board that fills the stage with the cameras in a strip above it; an audience member gets it read-only; the entry chunk has not grown.

No unit tests in this task, deliberately: the app has no test harness until Task 2, and a canvas cannot be judged in jsdom (`docs/ai/GOTCHAS.md:494`). The verification is the browser plus the bundle measurement, which is this repo's stated bar (`docs/ai/OPERATIONS.md:115`).

**Files:**
- Modify: `room-web/package.json` (one dependency)
- Create: `room-web/src/features/whiteboard/WhiteboardStage.tsx`
- Modify: `room-web/src/features/meeting/MeetingScreen.tsx:1-10, 36, 131-139, 149-154`
- Modify: `room-web/src/features/meeting/MeetingBar.tsx:1-40, 101-118`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `WhiteboardStage({ canDraw }: { canDraw: boolean })` — named export. `MeetingBar` gains `boardOpen: boolean` and `onToggleBoard: () => void`.

- [ ] **Step 1: Record the bundle baseline before installing anything**

```bash
cd /c/Projects/ceo-portal/room-web && npm run build && ls -l dist/assets/*.js | awk '{print $5, $9}'
```

Write the byte size of the single `index-*.js` down; Step 12 compares against it. Expected today: one JS asset of roughly 2.3 MB.

- [ ] **Step 2: Install Excalidraw**

```bash
npm --prefix /c/Projects/ceo-portal/room-web install --legacy-peer-deps @excalidraw/excalidraw@0.18.1
```

Expected: `added N packages`, no `ERESOLVE`. Pinned exactly — 0.18.1 is the version whose behaviour the spec's findings describe.

- [ ] **Step 3: Create the board component**

Create `room-web/src/features/whiteboard/WhiteboardStage.tsx`:

```tsx
import { useCallback, useState } from "react";
import { theme } from "antd";
import { Excalidraw } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";
import { useThemeMode } from "../../theme/useThemeMode";

/**
 * The shared whiteboard, on the meeting stage.
 *
 * <b>Not lazy in itself</b> — the whole module is lazy from `MeetingScreen`, so Excalidraw and its
 * 145 KB stylesheet live in this file's chunk and are fetched the first time somebody opens the
 * board. A second `lazy()` around `<Excalidraw>` would add a spinner and buy nothing.
 *
 * <b>`dir="ltr"` on the wrapper, on purpose.</b> The app is `dir="rtl"`, and Excalidraw positions its
 * toolbars and islands absolutely with transforms — the exact shape that breaks under RTL, where the
 * error doubles the moment anything is dragged (`docs/ai/GOTCHAS.md:1027`). A drawing surface has no
 * reading direction, its own UI is LTR upstream, and Persian text typed into a shape still shapes
 * correctly because the browser handles that per text run.
 */
export function WhiteboardStage({ canDraw }: { canDraw: boolean }) {
  const { token } = theme.useToken();
  const { mode } = useThemeMode();
  const [, setApi] = useState<ExcalidrawImperativeAPI | null>(null);

  const onApi = useCallback((api: ExcalidrawImperativeAPI) => setApi(api), []);

  return (
    <div
      dir="ltr"
      style={{
        height: "100%",
        // A canvas is the widest thing this app renders; without this it pushes the meeting chrome
        // off screen instead of fitting (docs/ai/GOTCHAS.md:357).
        minWidth: 0,
        borderRadius: token.borderRadius,
        overflow: "hidden",
        background: token.colorBgContainer,
      }}
    >
      <Excalidraw
        excalidrawAPI={onApi}
        theme={mode}
        langCode="fa-IR"
        // An audience member watches. Excalidraw's own read-only mode, so there are no tools to
        // hunt for — the same choice the bottom bar makes by omitting the publish buttons.
        viewModeEnabled={!canDraw}
      />
    </div>
  );
}
```

- [ ] **Step 4: Add the stage swap to `MeetingScreen`**

In `room-web/src/features/meeting/MeetingScreen.tsx`, add to the imports at the top (after line 1):

```tsx
import { lazy, Suspense, useEffect, useState } from "react";
```

(replacing the existing `import { useEffect, useState } from "react";`)

Then add below the last import (after line 11):

```tsx
/** Lazy: Excalidraw and its stylesheet must not be in the chunk every guest downloads. */
const WhiteboardStage = lazy(() =>
  import("../whiteboard/WhiteboardStage").then((m) => ({ default: m.WhiteboardStage })),
);
```

Add the state beside `panelOpen` (line 36):

```tsx
  const [boardOpen, setBoardOpen] = useState(false);
```

Replace the stage block (lines 131-139) with:

```tsx
          <div style={{ flex: 1, minHeight: 0, padding: 8 }}>
            {phase === "connecting" ? (
              <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
                <Typography.Text type="secondary">در حال اتصال به جلسه…</Typography.Text>
              </div>
            ) : boardOpen ? (
              <Suspense
                fallback={
                  <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
                    <Typography.Text type="secondary">در حال بارگذاری تخته…</Typography.Text>
                  </div>
                }
              >
                <WhiteboardStage canDraw={result.canPublish} />
              </Suspense>
            ) : (
              <MeetingStage />
            )}
          </div>
```

And pass the two new props to `MeetingBar` (lines 149-154):

```tsx
          <MeetingBar
            canPublish={result.canPublish}
            participantsOpen={panelOpen}
            onToggleParticipants={() => setPanelOpen((o) => !o)}
            boardOpen={boardOpen}
            onToggleBoard={() => setBoardOpen((o) => !o)}
            onLeave={() => setPhase("left")}
          />
```

- [ ] **Step 5: Add the toggle button to `MeetingBar`**

In `room-web/src/features/meeting/MeetingBar.tsx`, add `HighlightOutlined` to the icon import (line 2-10), then extend the props (lines 26-36):

```tsx
export function MeetingBar({
  canPublish,
  participantsOpen,
  onToggleParticipants,
  boardOpen,
  onToggleBoard,
  onLeave,
}: {
  canPublish: boolean;
  participantsOpen: boolean;
  onToggleParticipants: () => void;
  boardOpen: boolean;
  onToggleBoard: () => void;
  onLeave: () => void;
}) {
```

Add the button immediately before the participants `Tooltip` (line 101):

```tsx
        {/* Everyone can OPEN the board, including an audience member — watching the presenter draw is
            the point. Whether they may draw on it is `canPublish`, decided inside the board itself. */}
        <Tooltip title={boardOpen ? "بستن تخته" : "تخته اشتراکی"}>
          <Button
            shape="circle"
            size="large"
            type={boardOpen ? "primary" : "default"}
            aria-label={boardOpen ? "بستن تخته" : "تخته اشتراکی"}
            icon={<HighlightOutlined />}
            onClick={onToggleBoard}
          />
        </Tooltip>
```

- [ ] **Step 6: Typecheck and lint**

```bash
cd /c/Projects/ceo-portal/room-web && npm run typecheck && npm run lint
```

Expected: both silent, exit 0. A red `noUnusedLocals` here usually means the `setApi` state is unused — it is deliberately unused until Task 3, hence the `[, setApi]` destructure.

- [ ] **Step 7: Start the local stack**

```bash
docker start ceo-livekit-local
```

Then start `auth` (5100), `api` (5000) and `room-web` (5277) through the preview tooling — never `docker compose -f deploy/docker-compose.dev.yml up` (`AGENTS.md:121`).

- [ ] **Step 8: Open a meeting and the board**

Create a meeting at `http://room.localhost:5277/admin/new` as an administrator, join it from `/`, and press the new button. Expected: the Excalidraw editor fills the stage; the toolbar is on the left (it is LTR); drawing works.

- [ ] **Step 9: The RTL drag check — the one that would cost a day**

With a shape drawn and selected, run this in the browser console:

```js
(() => {
  const el = document.querySelector(".excalidraw .Island, .excalidraw__canvas");
  const cs = getComputedStyle(el);
  return { left: cs.left, transform: cs.transform, dir: document.dir, wrapperDir: el.closest("[dir]")?.dir };
})()
```

Expected: `wrapperDir: "ltr"`. Then **drag a shape 100 px to the right and confirm it lands under the cursor, not at double the distance.** A doubled offset means the `dir="ltr"` wrapper is not taking effect — fix that before going further, because every later task builds on the coordinates being right.

- [ ] **Step 10: The traps that bite in a browser only**

Confirm all four, in one pass:
1. **Image paste** — paste a screenshot onto the board. This is the path that touches Excalidraw's WASM font/image code, the code that sniffs for `process`. If it throws `process is not defined`, add `define: { "process.env": {} }` to `room-web/vite.config.ts` (the `analytics-web` precedent at `analytics-web/vite.config.ts:13-15`) and **never** define `process.versions` — see the spec's §9 row.
2. **The text tool** — type Persian into a text shape. Expected: correct shaping, right-to-left within the shape.
3. **Theme flip** — toggle light/dark in the app. Expected: the canvas repaints; no white-on-white and no black-on-black.
4. **Phone width** — 375 px viewport. Expected: the board is usable, Excalidraw collapses its toolbar to a top island, and the page does not scroll sideways.

- [ ] **Step 11: Confirm nobody downloads Excalidraw who did not open the board**

```bash
cd /c/Projects/ceo-portal/room-web && npm run build && ls -l dist/assets/*.js | awk '{print $5, $9}'
```

Expected: the `index-*.js` size is within a few KB of the Step 1 baseline, **and** new `WhiteboardStage-*.js` plus `WhiteboardStage-*.css` assets exist. If the entry chunk grew by megabytes, the lazy boundary is not working — check that nothing outside `WhiteboardStage.tsx` imports from `@excalidraw/excalidraw`.

- [ ] **Step 12: Commit**

```bash
cd /c/Projects/ceo-portal && git add room-web/package.json room-web/package-lock.json room-web/src/features/whiteboard/WhiteboardStage.tsx "room-web/src/features/meeting/MeetingScreen.tsx" room-web/src/features/meeting/MeetingBar.tsx && git commit -m "feat(room): an Excalidraw board on the meeting stage

Read-only for an audience member, via Excalidraw's own view mode. Lazy so the
editor and its stylesheet stay out of the chunk every guest downloads.

The wrapper is dir=\"ltr\" deliberately: Excalidraw positions its islands with
transforms, which is the shape that breaks under dir=rtl and doubles on drag."
```

---

### Task 2: Vitest, and the sync rules as tested pure functions

Deliverable: `npx vitest run` passes in `room-web` against a pure module that decides what to send, how to split it, what to accept, and from whom.

**Files:**
- Modify: `room-web/package.json` (2 scripts, 1 dev dependency)
- Modify: `room-web/vite.config.ts` (import from `vitest/config`, add a `test` block)
- Create: `room-web/src/features/whiteboard/wire.ts`
- Create: `room-web/src/features/whiteboard/wire.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces, all from `wire.ts`:
  - `interface BoardElement { id: string; version: number; [key: string]: unknown }`
  - `interface WhiteboardWireMessage { kind: "whiteboard"; elements: BoardElement[] }`
  - `const WHITEBOARD_TOPIC = "whiteboard"`
  - `const MAX_CHUNK_BYTES = 12_000`
  - `selectChanged(elements: readonly BoardElement[], lastVersions: Map<string, number>): BoardElement[]`
  - `rememberVersions(elements: readonly BoardElement[], lastVersions: Map<string, number>): void`
  - `byteLength(value: unknown): number`
  - `chunkByBytes(elements: readonly BoardElement[], maxBytes?: number): BoardElement[][]`
  - `encodeWhiteboardMessage(elements: readonly BoardElement[]): Uint8Array`
  - `decodeWhiteboardMessage(payload: Uint8Array): BoardElement[] | null`
  - `senderMayDraw(sender: { permissions?: { canPublish?: boolean } } | undefined): boolean`

**No jsdom, no canvas stubs, no `antd-jalali` stub.** These tests import one file that touches nothing but `JSON`, `TextEncoder` and `Map`, so the default node environment is enough — which sidesteps four separate documented traps (`GOTCHAS.md:494`, `:764`, `:787`, and the 0×0 element problem) at the cost of nothing. `packages/assessment-core` is the precedent for a vitest setup this plain.

- [ ] **Step 1: Add vitest**

```bash
npm --prefix /c/Projects/ceo-portal/room-web install --legacy-peer-deps -D vitest@^2.1.0
```

Then in `room-web/package.json`, add two scripts after `"lint"`:

```json
    "test": "vitest run",
    "test:watch": "vitest",
```

- [ ] **Step 2: Point Vite's config at vitest**

In `room-web/vite.config.ts`, change line 1 from `import { defineConfig } from "vite";` to:

```ts
import { defineConfig } from "vitest/config";
```

and add a `test` block after the `server` block:

```ts
  test: {
    globals: true,
    // Node, not jsdom: the only tests here exercise pure functions over JSON and TextEncoder. A
    // jsdom environment would drag in the canvas-context and antd-jalali stubs that analytics-web
    // needs, for no gain — see the plan's Task 2 note.
    environment: "node",
  },
```

- [ ] **Step 3: Write the failing tests**

Create `room-web/src/features/whiteboard/wire.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  MAX_CHUNK_BYTES,
  byteLength,
  chunkByBytes,
  decodeWhiteboardMessage,
  encodeWhiteboardMessage,
  rememberVersions,
  selectChanged,
  senderMayDraw,
  type BoardElement,
} from "./wire";

const el = (id: string, version: number, extra: Record<string, unknown> = {}): BoardElement =>
  ({ id, version, type: "rectangle", ...extra });

describe("selectChanged", () => {
  it("sends everything the first time", () => {
    const seen = new Map<string, number>();
    expect(selectChanged([el("a", 1), el("b", 1)], seen).map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("sends only the shape whose version moved", () => {
    const seen = new Map([["a", 1], ["b", 1]]);
    expect(selectChanged([el("a", 1), el("b", 2)], seen).map((e) => e.id)).toEqual(["b"]);
  });

  it("sends nothing when nothing changed", () => {
    const seen = new Map([["a", 1]]);
    expect(selectChanged([el("a", 1)], seen)).toEqual([]);
  });

  it("stops resending once the versions are remembered", () => {
    const seen = new Map<string, number>();
    const first = selectChanged([el("a", 1)], seen);
    rememberVersions(first, seen);
    expect(selectChanged([el("a", 1)], seen)).toEqual([]);
  });

  /**
   * The reason `rememberVersions` is called on RECEIVE as well as send: an element applied from
   * somebody else must not bounce straight back to them as our own change.
   */
  it("does not echo a shape that arrived from someone else", () => {
    const seen = new Map<string, number>();
    rememberVersions([el("a", 7)], seen);
    expect(selectChanged([el("a", 7)], seen)).toEqual([]);
  });
});

describe("chunkByBytes", () => {
  it("keeps a small delta in one message", () => {
    expect(chunkByBytes([el("a", 1), el("b", 1)])).toHaveLength(1);
  });

  /**
   * The bug this exists to prevent. The old implementation counted CHARACTERS against a byte limit;
   * Persian is two bytes per character in UTF-8, so a payload it believed was 12,000 was 24,000 on
   * the wire, over LiveKit's reliable ceiling, and dropped with no error anywhere.
   */
  it("splits Persian text by bytes, not characters", () => {
    const persian = "سلام".repeat(1500); // 6,000 chars ⇒ ~12,000 bytes each
    const chunks = chunkByBytes([el("a", 1, { text: persian }), el("b", 1, { text: persian })]);

    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(byteLength({ kind: "whiteboard", elements: chunk })).toBeLessThanOrEqual(MAX_CHUNK_BYTES);
    }
  });

  it("loses nothing when it splits", () => {
    const big = "x".repeat(5000);
    const ids = chunkByBytes([el("a", 1, { big }), el("b", 1, { big }), el("c", 1, { big })])
      .flat()
      .map((e) => e.id);
    expect(ids).toEqual(["a", "b", "c"]);
  });

  it("sends a single oversized shape alone rather than dropping it", () => {
    const huge = el("a", 1, { text: "x".repeat(MAX_CHUNK_BYTES * 2) });
    const chunks = chunkByBytes([huge, el("b", 1)]);
    expect(chunks[0]).toEqual([huge]);
    expect(chunks[1].map((e) => e.id)).toEqual(["b"]);
  });

  it("returns nothing for nothing", () => {
    expect(chunkByBytes([])).toEqual([]);
  });
});

describe("decodeWhiteboardMessage", () => {
  it("round-trips our own message", () => {
    const decoded = decodeWhiteboardMessage(encodeWhiteboardMessage([el("a", 3)]));
    expect(decoded).toEqual([el("a", 3)]);
  });

  const reject = (payload: unknown) =>
    decodeWhiteboardMessage(new TextEncoder().encode(JSON.stringify(payload)));

  it("ignores chat, which shares the channel", () => {
    expect(reject({ kind: "chat", id: 1, text: "سلام" })).toBeNull();
  });

  it("ignores a message with no kind", () => {
    expect(reject({ elements: [el("a", 1)] })).toBeNull();
  });

  it("ignores elements that are not an array", () => {
    expect(reject({ kind: "whiteboard", elements: "everything" })).toBeNull();
  });

  it("ignores an element missing an id or a version", () => {
    expect(reject({ kind: "whiteboard", elements: [{ version: 1 }] })).toBeNull();
    expect(reject({ kind: "whiteboard", elements: [{ id: "a" }] })).toBeNull();
  });

  it("ignores bytes that are not JSON at all", () => {
    expect(decodeWhiteboardMessage(new Uint8Array([0xff, 0x00, 0x42]))).toBeNull();
  });
});

describe("senderMayDraw", () => {
  it("accepts a sender the media server says may publish", () => {
    expect(senderMayDraw({ permissions: { canPublish: true } })).toBe(true);
  });

  /**
   * In a presentation only the presenter may publish, so this one boolean is the whole audience
   * rule — no branch on meeting type anywhere.
   */
  it("refuses a sender who may not publish", () => {
    expect(senderMayDraw({ permissions: { canPublish: false } })).toBe(false);
  });

  it("refuses when the sender or its permissions are unknown", () => {
    expect(senderMayDraw(undefined)).toBe(false);
    expect(senderMayDraw({})).toBe(false);
    expect(senderMayDraw({ permissions: {} })).toBe(false);
  });
});
```

- [ ] **Step 4: Run the tests to watch them fail**

```bash
cd /c/Projects/ceo-portal/room-web && npx vitest run
```

Expected: FAIL — `Failed to resolve import "./wire"`.

- [ ] **Step 5: Write the module**

Create `room-web/src/features/whiteboard/wire.ts`:

```ts
/**
 * The whiteboard's sync rules, as pure functions.
 *
 * Nothing here imports React, LiveKit or Excalidraw — which is what makes it testable in a node
 * process with no canvas, no jsdom and no media server. The hook next door is the only place that
 * knows about the data channel, and `WhiteboardStage` the only place that knows about Excalidraw.
 */

/** The part of an Excalidraw element this module needs. The real type carries dozens more fields. */
export interface BoardElement {
  id: string;
  version: number;
  [key: string]: unknown;
}

/** What travels over the data channel. `kind` is the same discriminator chat uses. */
export interface WhiteboardWireMessage {
  kind: "whiteboard";
  elements: BoardElement[];
}

/** Its own topic on the shared channel, so chat and board never see each other's traffic. */
export const WHITEBOARD_TOPIC = "whiteboard";

/**
 * LiveKit's reliable data messages top out around 15 KB. 12,000 leaves room for the envelope and a
 * margin — and it is counted in BYTES, which is the whole point: see `chunkByBytes`.
 */
export const MAX_CHUNK_BYTES = 12_000;

const encoder = new TextEncoder();

export function byteLength(value: unknown): number {
  return encoder.encode(JSON.stringify(value)).length;
}

/** The envelope's own cost, so a chunk cannot be sized as though it travelled bare. */
const ENVELOPE_BYTES = byteLength({ kind: "whiteboard", elements: [] } satisfies WhiteboardWireMessage);

/** The shapes whose version differs from the last one we sent or received. */
export function selectChanged(
  elements: readonly BoardElement[],
  lastVersions: Map<string, number>,
): BoardElement[] {
  return elements.filter((element) => lastVersions.get(element.id) !== element.version);
}

/**
 * Records what we have seen. Called after sending AND after applying a remote change — the second
 * one is what stops an element we just received bouncing back to its author as our own edit.
 */
export function rememberVersions(
  elements: readonly BoardElement[],
  lastVersions: Map<string, number>,
): void {
  for (const element of elements) lastVersions.set(element.id, element.version);
}

/**
 * Splits a delta into messages that each fit under `maxBytes` **on the wire**.
 *
 * Measured with `TextEncoder`, not `String.length`. Persian is two bytes per character in UTF-8, so
 * counting characters means a message believed to be 12,000 can be 24,000 bytes, over LiveKit's
 * ceiling, dropped silently. A single shape too big to fit travels alone rather than being lost.
 */
export function chunkByBytes(
  elements: readonly BoardElement[],
  maxBytes: number = MAX_CHUNK_BYTES,
): BoardElement[][] {
  const chunks: BoardElement[][] = [];
  let current: BoardElement[] = [];
  let used = ENVELOPE_BYTES;

  for (const element of elements) {
    const size = byteLength(element) + 1; // + the separating comma
    if (current.length > 0 && used + size > maxBytes) {
      chunks.push(current);
      current = [];
      used = ENVELOPE_BYTES;
    }
    current.push(element);
    used += size;
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

export function encodeWhiteboardMessage(elements: readonly BoardElement[]): Uint8Array {
  const message: WhiteboardWireMessage = { kind: "whiteboard", elements: [...elements] };
  return encoder.encode(JSON.stringify(message));
}

/**
 * Reads a payload off the shared channel, or returns null.
 *
 * Every participant can put whatever they like on this channel, so this is the boundary: the kind,
 * the shape of `elements`, and the two fields the sync logic relies on are all checked before
 * anything reaches the canvas. Chat rides the same channel and must fall through here untouched.
 */
export function decodeWhiteboardMessage(payload: Uint8Array): BoardElement[] | null {
  try {
    const wire = JSON.parse(new TextDecoder().decode(payload)) as WhiteboardWireMessage;
    if (wire?.kind !== "whiteboard" || !Array.isArray(wire.elements)) return null;

    const usable = wire.elements.every(
      (element) => typeof element?.id === "string" && typeof element?.version === "number",
    );
    return usable ? wire.elements : null;
  } catch {
    return null;
  }
}

/**
 * Whether an edit from this sender may be applied.
 *
 * The media server tells every browser each participant's publish permission, and a peer cannot
 * forge another peer's. In a presentation only the presenter may publish, so this single check is
 * the audience rule; in a meeting everybody may, so it lets everybody through. `=== true` on
 * purpose: an unknown sender or unknown permissions is a drop, not a maybe.
 */
export function senderMayDraw(
  sender: { permissions?: { canPublish?: boolean } } | undefined,
): boolean {
  return sender?.permissions?.canPublish === true;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
cd /c/Projects/ceo-portal/room-web && npx vitest run
```

Expected: `Test Files 1 passed (1)`, 19 tests passed.

- [ ] **Step 7: Prove the byte test bites**

Temporarily change `chunkByBytes` to size with `JSON.stringify(element).length` instead of `byteLength(element)`, re-run, and confirm **`splits Persian text by bytes, not characters` fails**. Then put it back. A test that cannot fail is not protecting anything.

- [ ] **Step 8: Typecheck, lint, commit**

```bash
cd /c/Projects/ceo-portal/room-web && npm run typecheck && npm run lint && npx vitest run
cd /c/Projects/ceo-portal && git add room-web/package.json room-web/package-lock.json room-web/vite.config.ts room-web/src/features/whiteboard/wire.ts room-web/src/features/whiteboard/wire.test.ts && git commit -m "test(room): vitest, and the whiteboard sync rules as pure functions

First tests in room-web. Node environment, no jsdom: the module under test
touches only JSON, TextEncoder and Map, which sidesteps the canvas-context and
antd-jalali stubs a jsdom setup would need.

Chunking is measured in bytes. The old implementation counted characters, and
Persian is two bytes each, so a message it believed was 12 KB went over
LiveKit's ceiling and vanished with no error."
```

---

### Task 3: Live sync between participants

Deliverable: two browsers in one meeting, drawing in either appears in the other; an audience member in a presentation cannot affect anyone else's board.

**Files:**
- Create: `room-web/src/features/whiteboard/useWhiteboardSync.ts`
- Modify: `room-web/src/features/whiteboard/WhiteboardStage.tsx`

**Interfaces:**
- Consumes: everything from `wire.ts` (Task 2).
- Produces:
  ```ts
  useWhiteboardSync(opts: {
    canDraw: boolean;
    onRemote: (elements: BoardElement[]) => void;
    getScene: () => readonly BoardElement[];
  }): { broadcastChanged: () => void; broadcastFull: () => void }
  ```

- [ ] **Step 1: Write the hook**

Create `room-web/src/features/whiteboard/useWhiteboardSync.ts`:

```ts
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDataChannel, useRoomContext } from "@livekit/components-react";
import { RoomEvent } from "livekit-client";
import {
  WHITEBOARD_TOPIC,
  chunkByBytes,
  decodeWhiteboardMessage,
  encodeWhiteboardMessage,
  rememberVersions,
  selectChanged,
  senderMayDraw,
  type BoardElement,
} from "./wire";

/**
 * Moves whiteboard edits between participants over the channel chat already uses.
 *
 * Thin on purpose: every rule lives in `wire.ts`, which is tested. What is here is the wiring that
 * cannot be tested without a media server — the subscription, the sender check, and the one full
 * resend when somebody new arrives.
 */
export function useWhiteboardSync({
  canDraw,
  onRemote,
  getScene,
}: {
  canDraw: boolean;
  onRemote: (elements: BoardElement[]) => void;
  getScene: () => readonly BoardElement[];
}) {
  const room = useRoomContext();

  // What we last sent or applied, per element. Also the echo guard — see rememberVersions.
  const lastVersions = useMemo(() => new Map<string, number>(), []);

  // Callbacks that change identity every render would re-subscribe the data channel constantly.
  const handlers = useRef({ onRemote, getScene });
  handlers.current = { onRemote, getScene };

  const onData = useCallback(
    (message: { payload: Uint8Array; from?: { permissions?: { canPublish?: boolean } } }) => {
      // The sender is attested by the media server; the payload is not. Anyone in the room can put
      // bytes on this channel, so an audience member's edits are refused here rather than trusted.
      if (!senderMayDraw(message.from)) return;

      const elements = decodeWhiteboardMessage(message.payload);
      if (!elements || elements.length === 0) return;

      rememberVersions(elements, lastVersions);
      handlers.current.onRemote(elements);
    },
    [lastVersions],
  );

  const { send } = useDataChannel(WHITEBOARD_TOPIC, onData);

  const publish = useCallback(
    (elements: readonly BoardElement[]) => {
      for (const chunk of chunkByBytes(elements)) {
        // Reliable: a lost delta would leave two people looking at different boards, and there is
        // no periodic full resend to repair it.
        void send(encodeWhiteboardMessage(chunk), { reliable: true }).catch(() => {
          // Nothing useful to tell the person drawing. The next change resends, and a newcomer gets
          // the whole board from the server.
        });
      }
    },
    [send],
  );

  const broadcastChanged = useCallback(() => {
    if (!canDraw) return;
    const changed = selectChanged(handlers.current.getScene(), lastVersions);
    if (changed.length === 0) return;
    rememberVersions(changed, lastVersions);
    publish(changed);
  }, [canDraw, lastVersions, publish]);

  const broadcastFull = useCallback(() => {
    if (!canDraw) return;
    const scene = handlers.current.getScene();
    if (scene.length === 0) return;
    rememberVersions(scene, lastVersions);
    publish(scene);
  }, [canDraw, lastVersions, publish]);

  /**
   * One full resend when a participant joins.
   *
   * This is what a late joiner's first seconds rest on, and it replaces the old implementation's
   * ten-second timer: it fires exactly when it is needed and never otherwise. The old version's
   * equivalent was gated on a "host" check that could never be true, so it never ran at all.
   */
  useEffect(() => {
    if (!canDraw) return;
    const onJoin = () => broadcastFull();
    room.on(RoomEvent.ParticipantConnected, onJoin);
    return () => {
      room.off(RoomEvent.ParticipantConnected, onJoin);
    };
  }, [room, canDraw, broadcastFull]);

  return { broadcastChanged, broadcastFull };
}
```

- [ ] **Step 2: Wire it into the board**

Replace `room-web/src/features/whiteboard/WhiteboardStage.tsx` in full:

```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { theme } from "antd";
import { Excalidraw, reconcileElements } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import "@excalidraw/excalidraw/index.css";
import { useThemeMode } from "../../theme/useThemeMode";
import { useWhiteboardSync } from "./useWhiteboardSync";
import type { BoardElement } from "./wire";

/** Local edits are gathered for this long before going out, so a stroke is one message not fifty. */
const CHANGE_DEBOUNCE_MS = 150;

/**
 * The shared whiteboard, on the meeting stage.
 *
 * <b>Not lazy in itself</b> — the whole module is lazy from `MeetingScreen`, so Excalidraw and its
 * 145 KB stylesheet live in this file's chunk and are fetched the first time somebody opens the
 * board.
 *
 * <b>`dir="ltr"` on the wrapper, on purpose.</b> The app is `dir="rtl"`, and Excalidraw positions its
 * toolbars and islands absolutely with transforms — the exact shape that breaks under RTL, where the
 * error doubles the moment anything is dragged (`docs/ai/GOTCHAS.md:1027`). A drawing surface has no
 * reading direction, its own UI is LTR upstream, and Persian text typed into a shape still shapes
 * correctly because the browser handles that per text run.
 */
export function WhiteboardStage({ canDraw }: { canDraw: boolean }) {
  const { token } = theme.useToken();
  const { mode } = useThemeMode();
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  apiRef.current = api;

  const getScene = useCallback(
    () => (apiRef.current?.getSceneElementsIncludingDeleted() ?? []) as unknown as BoardElement[],
    [],
  );

  /** Excalidraw's own merge: newest version of each element wins, ordering preserved. */
  const onRemote = useCallback((elements: BoardElement[]) => {
    const current = apiRef.current;
    if (!current) return;

    const merged = reconcileElements(
      current.getSceneElementsIncludingDeleted() as OrderedExcalidrawElement[],
      elements as unknown as RemoteExcalidrawElement[],
      current.getAppState(),
    );
    current.updateScene({ elements: merged });
  }, []);

  const { broadcastChanged } = useWhiteboardSync({ canDraw, onRemote, getScene });

  // One timer for the component's life, cleared on unmount — an uncancelled debounce firing after
  // the board closes was one of the old implementation's leaks.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const onChange = useMemo(
    () => () => {
      if (!canDraw) return;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(broadcastChanged, CHANGE_DEBOUNCE_MS);
    },
    [canDraw, broadcastChanged],
  );

  return (
    <div
      dir="ltr"
      style={{
        height: "100%",
        // A canvas is the widest thing this app renders; without this it pushes the meeting chrome
        // off screen instead of fitting (docs/ai/GOTCHAS.md:357).
        minWidth: 0,
        borderRadius: token.borderRadius,
        overflow: "hidden",
        background: token.colorBgContainer,
      }}
    >
      <Excalidraw
        excalidrawAPI={setApi}
        onChange={onChange}
        theme={mode}
        langCode="fa-IR"
        // An audience member watches. Excalidraw's own read-only mode, so there are no tools to
        // hunt for — the same choice the bottom bar makes by omitting the publish buttons.
        viewModeEnabled={!canDraw}
      />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck and lint**

```bash
cd /c/Projects/ceo-portal/room-web && npm run typecheck && npm run lint && npx vitest run
```

Expected: all three clean. A failure resolving `@excalidraw/excalidraw/element/types` means `moduleResolution` is not `bundler`; check `room-web/tsconfig.json` before changing the imports.

- [ ] **Step 4: Two windows, a meeting — the criterion**

With the local stack running, open the same meeting in two browser windows (one as the presenter, one as a second member or a guest through the link). Draw in the first.

Expected: the shape appears in the second within a moment. Then draw in the second and confirm it appears in the first. **This is the path that has never been observed working in this feature area, for the whiteboard or for chat** (`docs/worklog/2026-07-31-room-step-9-chat.md:117`).

- [ ] **Step 5: The audience check, in a presentation**

Make a **Presentation** with a public link. Join as the presenter in one window and as a link guest in another.

Expected: the guest sees the board with no tools; the presenter's drawing reaches the guest. Then, in the guest's console, forge an edit:

```js
(() => {
  const room = document.querySelector("[data-lk-theme]") && window.__lkRoom;
  return "run this only if a room handle is exposed; otherwise skip — the UI check above is the requirement";
})()
```

If a room handle is not reachable from the console, skip the forgery attempt and record that in the worklog rather than claiming it was tested. The UI half — no tools for the audience — is the requirement; the sender check has unit coverage from Task 2.

- [ ] **Step 6: The late-joiner resend**

With a board drawn in window 1, open window 2 fresh.

Expected: window 2 shows the existing drawing within a second or two, from the join-time full resend. (Until Task 5 this is the *only* catch-up path, so a failure here is expected to be fixed by Task 5's server load rather than by patching this step.)

- [ ] **Step 7: Commit**

```bash
cd /c/Projects/ceo-portal && git add room-web/src/features/whiteboard/ && git commit -m "feat(room): live whiteboard sync over the data channel

Version-deltas on their own topic, debounced, byte-chunked, reliable. Inbound
edits are accepted only from a sender the media server says may publish, which
in a presentation is the presenter alone and in a meeting is everybody — one
rule, no branch on meeting type.

A full resend fires when a participant joins, instead of the old ten-second
timer that was gated on a host check that could never be true."
```

---

### Task 4: The board, saved

Deliverable: two API routes and one table; six backend tests pass on the server.

**Files:**
- Create: `src/Domain/Rooms/RoomBoard.cs`
- Modify: `src/Infrastructure/Data/Configurations/Rooms/RoomConfigurations.cs` (append a configuration)
- Modify: `src/Application/Common/Interfaces/IApplicationDbContext.cs:73` (after `RoomMessages`)
- Modify: `src/Infrastructure/Data/ApplicationDbContext.cs:78` (after `RoomMessages`)
- Create: `src/Application/Rooms/RoomBoard.cs`
- Modify: `src/Web/Endpoints/Rooms/Room.cs:50-51` (routes) and the handler region
- Create: `tests/Application.FunctionalTests/Rooms/RoomBoardTests.cs`
- Create: one migration under `src/Infrastructure/Data/Migrations/`

**Interfaces:**
- Consumes: `RoomChatAccess.ResolveAsync` / `.FindAsync` (existing, `src/Application/Rooms/RoomChat.cs:41-102`), `Room.MayPublish` (existing, `src/Domain/Rooms/Room.cs:122-127`).
- Produces: `GET /api/Room/{id}/board` → `RoomBoardDto?`; `PUT /api/Room/{id}/board` ← `{ scene: string }`. `RoomBoardDto(string Scene, DateTimeOffset UpdatedAtUtc)`.

- [ ] **Step 1: Write the failing tests**

Create `tests/Application.FunctionalTests/Rooms/RoomBoardTests.cs`:

```csharp
using Mabhas19.Application.FunctionalTests.Infrastructure;
using Mabhas19.Application.Rooms;
using Mabhas19.Domain.Rooms;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.FunctionalTests.Rooms;

/// <summary>
/// The saved whiteboard, and who may write to it.
/// </summary>
/// <remarks>
/// The board is delivered live over the media server's data channel; this is the copy a reload and a
/// late joiner read. Which makes the write gate the interesting half: in a presentation only the
/// presenter may draw, and that must be decided here rather than by the browser, because every
/// participant's token lets them put bytes on the data channel.
/// </remarks>
public class RoomBoardTests : TestBase
{
    private const string Presenter = "5555555555";
    private const string Member = "1234567890";

    private static EngineerInfo Engineer(string nationalCode, string firstName = "آزمون") => new(
        NationalCode: nationalCode,
        FirstName: firstName,
        LastName: "مهندس",
        ReshteCode: "4",
        Mobile: "09120000000",
        MembershipStatus: 0,
        LicenceExpiryJalali: "1499/12/29",
        EducationLevel: "کارشناسی");

    [SetUp]
    public void SeedPeople()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Presenter, "ارائه‌دهنده"));
        FunctionalTestSetup.Directory.Add(Engineer(Member, "عضو"));
    }

    private const string Scene = """{"type":"excalidraw","elements":[{"id":"a","version":1}]}""";

    private static async Task<Room> SeedAsync(
        RoomType type = RoomType.Presentation,
        RoomJoinMode joinMode = RoomJoinMode.Public,
        bool isActive = true)
    {
        var room = new Room
        {
            Name = "کارگاه طراحی",
            Slug = RoomRules.NewSlug(),
            Type = type,
            JoinMode = joinMode,
            JoinToken = RoomRules.NeedsJoinToken(joinMode) ? RoomRules.NewJoinToken() : null,
            PresenterUserId = type == RoomType.Presentation ? Presenter : null,
            PresenterName = type == RoomType.Presentation ? "ارائه‌دهنده مهندس" : null,
            StartsAtUtc = DateTimeOffset.UtcNow.AddMinutes(-5),
            EarlyJoinMinutes = 0,
            MaxParticipants = 50,
            IsActive = isActive,
        };

        await TestApp.AddAsync(room);
        return room;
    }

    private static async Task<RoomJoinDto> JoinAsGuestAsync(Room room, string name = "رضا احمدی")
    {
        TestApp.SignOut();
        return await TestApp.SendAsync(new JoinRoomByLinkCommand(room.JoinToken!, name));
    }

    [Test]
    public async Task The_presenter_saves_a_board_and_reads_it_back()
    {
        var room = await SeedAsync();
        TestApp.RunAsEngineerAsync(Presenter);

        await TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, null, Scene));

        var saved = await TestApp.SendAsync(new GetRoomBoardQuery(room.Id, null));

        saved.ShouldNotBeNull();
        saved!.Scene.ShouldBe(Scene);
    }

    [Test]
    public async Task An_empty_room_has_no_board_rather_than_an_error()
    {
        var room = await SeedAsync();
        TestApp.RunAsEngineerAsync(Presenter);

        (await TestApp.SendAsync(new GetRoomBoardQuery(room.Id, null))).ShouldBeNull();
    }

    [Test]
    public async Task Saving_twice_replaces_the_board_rather_than_adding_a_second()
    {
        var room = await SeedAsync();
        TestApp.RunAsEngineerAsync(Presenter);

        await TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, null, Scene));
        await TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, null, """{"elements":[]}"""));

        (await TestApp.CountAsync<RoomBoard>()).ShouldBe(1);
        (await TestApp.SendAsync(new GetRoomBoardQuery(room.Id, null)))!.Scene.ShouldBe("""{"elements":[]}""");
    }

    [Test]
    public async Task An_audience_guest_can_READ_the_board_but_not_write_to_it()
    {
        var room = await SeedAsync();
        TestApp.RunAsEngineerAsync(Presenter);
        await TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, null, Scene));

        var join = await JoinAsGuestAsync(room);

        // Watching the presenter draw is the point, so reading is allowed.
        (await TestApp.SendAsync(new GetRoomBoardQuery(room.Id, join.Token)))!.Scene.ShouldBe(Scene);

        // Drawing is not. Their token lets them put bytes on the data channel — nothing stops that —
        // so this is where a forged edit is actually refused.
        await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, join.Token, """{"elements":[]}""")));

        (await TestApp.SendAsync(new GetRoomBoardQuery(room.Id, join.Token)))!.Scene.ShouldBe(Scene);
    }

    [Test]
    public async Task In_a_MEETING_any_invited_member_may_write()
    {
        var room = await SeedAsync(RoomType.Meeting, RoomJoinMode.InviteOnly);
        await TestApp.AddAsync(new RoomInvite { RoomId = room.Id, UserId = Member, UserName = "عضو مهندس" });

        TestApp.RunAsEngineerAsync(Member);
        await TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, null, Scene));

        (await TestApp.SendAsync(new GetRoomBoardQuery(room.Id, null)))!.Scene.ShouldBe(Scene);
    }

    [Test]
    public async Task A_token_for_another_meeting_cannot_read_or_write_this_board()
    {
        var mine = await SeedAsync();
        var theirs = await SeedAsync();
        var join = await JoinAsGuestAsync(theirs);

        await Should.ThrowAsync<Ardalis.GuardClauses.NotFoundException>(
            () => TestApp.SendAsync(new GetRoomBoardQuery(mine.Id, join.Token)));

        await Should.ThrowAsync<Ardalis.GuardClauses.NotFoundException>(
            () => TestApp.SendAsync(new SaveRoomBoardCommand(mine.Id, join.Token, Scene)));
    }

    [Test]
    public async Task A_closed_meeting_keeps_its_board_readable_and_takes_no_more_saves()
    {
        var room = await SeedAsync();
        TestApp.RunAsEngineerAsync(Presenter);
        await TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, null, Scene));

        await TestApp.MutateAsync<Room>(r => r.IsActive = false, room.Id);

        var error = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, null, """{"elements":[]}""")));
        error.Errors["Scene"].ShouldContain(x => x.Contains("بسته"));

        (await TestApp.SendAsync(new GetRoomBoardQuery(room.Id, null)))!.Scene.ShouldBe(Scene);
    }

    [Test]
    public async Task A_scene_over_the_size_cap_is_refused_rather_than_truncated()
    {
        var room = await SeedAsync();
        TestApp.RunAsEngineerAsync(Presenter);

        // A truncated scene is corrupt, where a truncated chat line is merely short.
        var huge = new string('x', RoomBoardRules.MaxSceneLength + 1);

        await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, null, huge)));

        (await TestApp.CountAsync<RoomBoard>()).ShouldBe(0);
    }
}
```

- [ ] **Step 2: Create the entity**

Create `src/Domain/Rooms/RoomBoard.cs`:

```csharp
using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Rooms;

/// <summary>
/// One meeting's whiteboard. Delivered live over the media server's data channel; this is the copy
/// that survives a reload and lets somebody who joined late see what is already drawn.
/// </summary>
/// <remarks>
/// <para>
/// <see cref="Scene"/> is stored <b>opaque</b>: it is whatever the editor serialised, kept as text and
/// never modelled here. An Excalidraw scene is a large, evolving shape, and a typed DTO would silently
/// drop every field it did not declare — see GOTCHAS.
/// </para>
/// <para>
/// One row per meeting. <see cref="UpdatedBy"/> records who last saved, for the same reason a chat line
/// records its sender — but unlike chat it is never returned to a client, because for an engineer that
/// identity is their کد ملی.
/// </para>
/// </remarks>
public class RoomBoard : BaseAuditableEntity
{
    public int RoomId { get; set; }

    public Room Room { get; set; } = null!;

    public required string Scene { get; set; }

    public required string UpdatedBy { get; set; }
}
```

- [ ] **Step 3: Configure it**

Append to `src/Infrastructure/Data/Configurations/Rooms/RoomConfigurations.cs`:

```csharp

public class RoomBoardConfiguration : IEntityTypeConfiguration<RoomBoard>
{
    public void Configure(EntityTypeBuilder<RoomBoard> b)
    {
        b.ToTable("RoomBoards");

        // nvarchar(max): a scene has no useful upper bound in schema terms. The cap that matters is
        // RoomBoardRules.MaxSceneLength, enforced where the write happens so it can be REFUSED —
        // a silently truncated scene is corrupt JSON.
        b.Property(x => x.Scene).IsRequired();
        b.Property(x => x.UpdatedBy).HasMaxLength(64).IsRequired();

        // One board per meeting, guaranteed by the database rather than by the handler remembering.
        b.HasIndex(x => x.RoomId).IsUnique();

        b.HasOne(x => x.Room)
            .WithMany()
            .HasForeignKey(x => x.RoomId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
```

- [ ] **Step 4: Register the DbSet in both places**

In `src/Application/Common/Interfaces/IApplicationDbContext.cs`, after line 73 (`DbSet<RoomMessage> RoomMessages { get; }`):

```csharp

    DbSet<RoomBoard> RoomBoards { get; }
```

In `src/Infrastructure/Data/ApplicationDbContext.cs`, after line 78:

```csharp

    public DbSet<RoomBoard> RoomBoards => Set<RoomBoard>();
```

Miss the interface and you get around twenty misleading `CS1061` errors pointing at the handler (`docs/ai/GOTCHAS.md:707`).

- [ ] **Step 5: Write the query, the command and the rule**

Create `src/Application/Rooms/RoomBoard.cs`:

```csharp
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Rooms;
using Mabhas19.Domain.Rooms;

namespace Mabhas19.Application.Rooms;

public sealed record RoomBoardDto(string Scene, DateTimeOffset UpdatedAtUtc);

/// <summary>Shape rules for a saved board. No database, no clock.</summary>
public static class RoomBoardRules
{
    /// <summary>
    /// Roughly a very full board of shapes and text. A pasted photograph is what exceeds it, and that
    /// is the case worth refusing loudly rather than storing.
    /// </summary>
    public const int MaxSceneLength = 2_000_000;
}

// ── reading ──────────────────────────────────────────────────────────────────

/// <summary>
/// The saved whiteboard, or null when nobody has drawn yet.
/// </summary>
/// <remarks>
/// Anonymous like the chat routes, and credentialled the same way: a guest presents the media token we
/// signed for them. Reading is allowed to anyone who may be in the meeting — in a presentation the
/// audience watches the presenter draw, which is the point.
/// </remarks>
public record GetRoomBoardQuery(int RoomId, string? RoomToken) : IRequest<RoomBoardDto?>;

public class GetRoomBoardQueryHandler(
    IApplicationDbContext context,
    IUser user,
    IRoomTokenService tokens,
    IRoomJoiner joiner) : IRequestHandler<GetRoomBoardQuery, RoomBoardDto?>
{
    public async Task<RoomBoardDto?> Handle(GetRoomBoardQuery request, CancellationToken cancellationToken)
    {
        var room = await RoomChatAccess.FindAsync(context, request.RoomId, cancellationToken);

        await RoomChatAccess.ResolveAsync(room, request.RoomToken, user, tokens, joiner, cancellationToken);

        var board = await context.RoomBoards
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.RoomId == request.RoomId, cancellationToken);

        return board is null ? null : new RoomBoardDto(board.Scene, board.LastModified ?? board.Created);
    }
}

// ── writing ──────────────────────────────────────────────────────────────────

/// <summary>
/// Replaces the saved board.
/// </summary>
/// <remarks>
/// <para>
/// The whole scene, not a delta: every client has already merged everyone's shapes, so any drawer's
/// copy is a complete and valid board. Last write wins, and that is safe for the same reason.
/// </para>
/// <para>
/// <b>The gate is <see cref="Room.MayPublish"/></b> — the same predicate that decides the microphone.
/// The pen follows the mic, in one place, so the two cannot drift apart. It is enforced here and not
/// only in the browser because every participant's token grants data-channel publishing, audience
/// included: refusing the save is what actually stops a forged edit from lasting.
/// </para>
/// </remarks>
public record SaveRoomBoardCommand(int RoomId, string? RoomToken, string Scene) : IRequest;

public class SaveRoomBoardCommandHandler(
    IApplicationDbContext context,
    IUser user,
    IRoomTokenService tokens,
    IRoomJoiner joiner) : IRequestHandler<SaveRoomBoardCommand>
{
    public async Task Handle(SaveRoomBoardCommand request, CancellationToken cancellationToken)
    {
        var room = await RoomChatAccess.FindAsync(context, request.RoomId, cancellationToken);

        var writer = await RoomChatAccess.ResolveAsync(
            room, request.RoomToken, user, tokens, joiner, cancellationToken);

        // Closing a meeting stops it taking new work. The board stays readable — closing the doors is
        // not deleting the record.
        if (room!.IsActive == false)
        {
            throw RoomGuard.Invalid("Scene", RoomJoinRules.Message(JoinDenyReason.Closed));
        }

        if (!room.MayPublish(writer.SenderId))
        {
            throw RoomGuard.Invalid("Scene", "در این ارائه فقط ارائه‌دهنده می‌تواند روی تخته بنویسد");
        }

        if (string.IsNullOrWhiteSpace(request.Scene))
        {
            throw RoomGuard.Invalid("Scene", "تخته خالی است");
        }

        if (request.Scene.Length > RoomBoardRules.MaxSceneLength)
        {
            throw RoomGuard.Invalid("Scene", "حجم تخته بیش از حد مجاز است");
        }

        var board = await context.RoomBoards
            .FirstOrDefaultAsync(x => x.RoomId == room.Id, cancellationToken);

        if (board is null)
        {
            context.RoomBoards.Add(new RoomBoard
            {
                RoomId = room.Id,
                Scene = request.Scene,
                UpdatedBy = writer.SenderId,
            });
        }
        else
        {
            board.Scene = request.Scene;
            board.UpdatedBy = writer.SenderId;
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}
```

- [ ] **Step 6: Map the routes**

In `src/Web/Endpoints/Rooms/Room.cs`, after line 51:

```csharp

        // The whiteboard. Anonymous and credentialled exactly like chat — and the write is gated on
        // the same predicate as the microphone, inside the handler.
        groupBuilder.MapGet(GetRoomBoard, "{id:int}/board").AllowAnonymous();
        groupBuilder.MapPut(SaveRoomBoard, "{id:int}/board").AllowAnonymous();
```

And at the end of the class, after `SendRoomMessage`:

```csharp

    /// <summary>The saved whiteboard, or 204 when nobody has drawn yet.</summary>
    public static async Task<Results<Ok<RoomBoardDto>, NoContent>> GetRoomBoard(
        ISender sender, HttpRequest http, int id)
    {
        var board = await sender.Send(
            new GetRoomBoardQuery(id, http.Headers[RoomTokenHeader].FirstOrDefault()));

        return board is null ? TypedResults.NoContent() : TypedResults.Ok(board);
    }

    public sealed record SaveBoardRequest(string Scene);

    /// <summary>
    /// Replaces the board. Named <c>SaveRoomBoard</c>, not <c>SaveBoard</c>: two endpoint handlers
    /// sharing a method name once made the WHOLE API return 500, including routes nobody had touched.
    /// </summary>
    public static async Task<NoContent> SaveRoomBoard(
        ISender sender, HttpRequest http, int id, SaveBoardRequest request)
    {
        await sender.Send(
            new SaveRoomBoardCommand(id, http.Headers[RoomTokenHeader].FirstOrDefault(), request.Scene));

        return TypedResults.NoContent();
    }
```

- [ ] **Step 7: Build, then create the migration**

```bash
cd /c/Projects/ceo-portal && dotnet build src/Web/Web.csproj
```

Expected: 0 errors. **Build `src/Web` first and never pass `--no-build`** — `dotnet ef` reads the startup project's `bin`, and a stale one produces an empty migration that commits and deploys perfectly happily (`docs/ai/GOTCHAS.md:953`).

```bash
dotnet ef migrations add AddRoomBoards --project src/Infrastructure --startup-project src/Web --output-dir Data/Migrations
```

Then open the generated file and confirm `Up()` actually creates `RoomBoards` with a unique index on `RoomId`. An empty `Up()` means the stale-binary trap caught you.

If restore fails locally, run both commands in the SDK container per `docs/ai/OPERATIONS.md:104`.

- [ ] **Step 8: Run the tests**

```bash
cd /c/Projects/ceo-portal && dotnet test tests/Application.FunctionalTests --filter "FullyQualifiedName~RoomBoardTests"
```

Expected: 8 passed. Run the whole room area too, since `Room.cs` and the DbContext changed:

```bash
dotnet test tests/Application.FunctionalTests --filter "FullyQualifiedName~Rooms"
```

Note: three pre-existing failures elsewhere in the functional suite are recorded in the room worklogs — compare against those rather than treating them as new.

- [ ] **Step 9: Commit**

```bash
cd /c/Projects/ceo-portal && git add src/Domain/Rooms/RoomBoard.cs src/Application/Rooms/RoomBoard.cs src/Application/Common/Interfaces/IApplicationDbContext.cs src/Infrastructure/Data/ApplicationDbContext.cs src/Infrastructure/Data/Configurations/Rooms/RoomConfigurations.cs src/Infrastructure/Data/Migrations/ src/Web/Endpoints/Rooms/Room.cs tests/Application.FunctionalTests/Rooms/RoomBoardTests.cs && git commit -m "feat(api): save a meeting's whiteboard

One row per room, the scene stored opaque so no field can be dropped by a DTO
that has not heard of it. Authorisation reuses the chat resolver unchanged; the
write gate is Room.MayPublish, the same predicate as the microphone, so the pen
and the mic cannot drift apart.

Enforced server-side because every participant's token grants data-channel
publishing, audience included — refusing the save is what makes a forged edit
temporary."
```

---

### Task 5: Load and save from the browser

Deliverable: a reload restores the board; a late joiner sees it; drawing costs about six requests a minute per person drawing.

**Files:**
- Modify: `room-web/src/lib/types.ts` (append near the chat section)
- Modify: `room-web/src/lib/queries.ts:23` (a key) and the end of the file
- Modify: `room-web/src/features/whiteboard/WhiteboardStage.tsx`
- Modify: `room-web/src/features/meeting/MeetingScreen.tsx` (pass `roomId`)

**Interfaces:**
- Consumes: `GET`/`PUT /api/Room/{id}/board` (Task 4); `WhiteboardStage` (Tasks 1, 3).
- Produces: `useRoomBoard(roomId, enabled)`, `useSaveRoomBoard(roomId)`; `WhiteboardStage` gains a required `roomId: number` prop.

- [ ] **Step 1: The DTO**

Append to `room-web/src/lib/types.ts`:

```ts

// ── whiteboard ───────────────────────────────────────────────────────────────

/**
 * The saved board. `scene` is opaque — whatever the editor serialised — and is handed straight back
 * to it. Nothing in this app reads inside it.
 */
export interface RoomBoard {
  scene: string;
  updatedAtUtc: string;
}
```

- [ ] **Step 2: The queries**

In `room-web/src/lib/queries.ts`, add to `roomKeys` (after line 23):

```ts
  board: (id: number) => ["room-board", id] as const,
```

Add `RoomBoard` to the type import block at the top, then append at the end of the file:

```ts

// ── whiteboard ───────────────────────────────────────────────────────────────

/**
 * The saved board for one meeting.
 *
 * Fetched once when the board opens; after that changes arrive over the data channel. Same reasoning
 * as chat history — a meeting that polled would cost every participant a request every few seconds
 * against a rate limit they share with everyone behind their NAT.
 */
export function useRoomBoard(roomId: number, enabled: boolean) {
  return useQuery({
    queryKey: roomKeys.board(roomId),
    queryFn: () => apiGet<RoomBoard | undefined>(`${ATTENDEE}/${roomId}/board`),
    enabled: !!roomId && enabled,
    staleTime: Infinity,
  });
}

/** Replaces the board. The whole scene, because any drawer's copy is already everyone's merged board. */
export function useSaveRoomBoard(roomId: number) {
  return useMutation({
    mutationFn: (scene: string) => apiPut<void>(`${ATTENDEE}/${roomId}/board`, { scene }),
    retry: false,
  });
}
```

- [ ] **Step 3: Load and save inside the board**

In `room-web/src/features/whiteboard/WhiteboardStage.tsx`, extend the props and add the two effects. Change the signature to:

```tsx
export function WhiteboardStage({ roomId, canDraw }: { roomId: number; canDraw: boolean }) {
```

Add these imports:

```tsx
import { useRoomBoard, useSaveRoomBoard } from "../../lib/queries";
```

Add after the `api` state:

```tsx
  const { data: saved } = useRoomBoard(roomId, true);
  const save = useSaveRoomBoard(roomId);
```

Add this constant next to `CHANGE_DEBOUNCE_MS`:

```tsx
/** How long after the last local change the whole board is written to the server. */
const SAVE_DEBOUNCE_MS = 10_000;
```

Add the load effect, after `onRemote`:

```tsx
  // The saved board, applied once when the editor is ready. Live changes then correct it, so a
  // slightly stale save is repaired by the first delta rather than being a problem.
  const loaded = useRef(false);
  useEffect(() => {
    if (loaded.current || !api || !saved?.scene) return;
    loaded.current = true;
    try {
      const scene = JSON.parse(saved.scene) as { elements?: unknown };
      if (Array.isArray(scene.elements)) {
        api.updateScene({ elements: scene.elements as OrderedExcalidrawElement[] });
      }
    } catch {
      // A board we cannot parse is a board we do not draw. Better an empty canvas than a crash on
      // open, and the next save replaces it.
    }
  }, [api, saved]);
```

Then extend `onChange` so it schedules the save as well as the broadcast:

```tsx
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onChange = useMemo(
    () => () => {
      if (!canDraw) return;

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(broadcastChanged, CHANGE_DEBOUNCE_MS);

      // Only somebody who actually drew saves, and only once they have stopped. Ten people watching
      // cost nothing; three people sketching cost about eighteen requests a minute between them.
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        const elements = apiRef.current?.getSceneElementsIncludingDeleted() ?? [];
        save.mutate(JSON.stringify({ type: "excalidraw", elements }));
      }, SAVE_DEBOUNCE_MS);
    },
    [canDraw, broadcastChanged, save],
  );
```

Extend the unmount cleanup to cover both timers and to flush a final save:

```tsx
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        // Closing the board must not throw away the last few seconds of drawing.
        const elements = apiRef.current?.getSceneElementsIncludingDeleted() ?? [];
        if (elements.length > 0) save.mutate(JSON.stringify({ type: "excalidraw", elements }));
      }
    },
    [save],
  );
```

- [ ] **Step 4: Pass the room id**

In `room-web/src/features/meeting/MeetingScreen.tsx`, change the render to:

```tsx
                <WhiteboardStage roomId={result.roomId} canDraw={result.canPublish} />
```

- [ ] **Step 5: Typecheck, lint, test**

```bash
cd /c/Projects/ceo-portal/room-web && npm run typecheck && npm run lint && npx vitest run
```

- [ ] **Step 6: Watch the requests**

With the board open and the network tab filtered to `board`:

1. Open the board → exactly **one** `GET`, answering 204 the first time.
2. Draw, then stop → **one** `PUT` about ten seconds later, then nothing.
3. Keep drawing for a minute → roughly **six** `PUT`s, not sixty.
4. Close the board → one final `PUT`.

If a `PUT` returns **429**, the debounce is not working — do not raise the limit.

- [ ] **Step 7: The two criteria this task exists for**

- **Reload:** draw, wait for the `PUT`, reload the page, reopen the board. The drawing is there.
- **Late joiner:** with the board drawn in window 1, join fresh in window 2 and open the board. The drawing is there — this time from the `GET`, not the peer resend.
- **Audience:** as a guest in a presentation, confirm the `GET` succeeds and no `PUT` is ever sent.

- [ ] **Step 8: Commit**

```bash
cd /c/Projects/ceo-portal && git add room-web/src/lib/types.ts room-web/src/lib/queries.ts room-web/src/features/whiteboard/WhiteboardStage.tsx "room-web/src/features/meeting/MeetingScreen.tsx" && git commit -m "feat(room): the whiteboard survives a reload

Loaded once when the board opens, written back ten seconds after the last local
change and once more on close. Only a client that actually drew saves, so a
meeting where nobody draws costs nothing and three people sketching cost about
eighteen requests a minute against the shared 120.

A scene that will not parse leaves an empty canvas rather than crashing on open."
```

---

### Task 6: Ship it, and write the record

**Files:**
- Create: `docs/worklog/2026-08-17-room-whiteboard.md`
- Modify: `docs/worklog/README.md` (index line, newest first)
- Modify: `docs/ai/GOTCHAS.md` and `docs/ai/PROJECT-MAP.md` if anything reusable was learned

- [ ] **Step 1: Full front-end gate**

```bash
cd /c/Projects/ceo-portal/room-web && npm run build && npm run lint && npx vitest run
```

- [ ] **Step 2: Deploy the API first, then the front end**

The API carries the new table and routes; the front end calls them. Shipping the SPA first would give every drawer a `404` on save. Follow the incremental loop in `docs/ai/OPERATIONS.md:44-62`: package the changed files, upload, **build as its own step and read its result**, then `up -d --no-deps` the one service. `api` first, then `room-web`.

A failed build still lets a recreate succeed and serve the previous image, healthy and green (`docs/ai/OPERATIONS.md:69`) — so compare the container's image id before and after, not just its health.

- [ ] **Step 3: Verify on production**

- `room.myceo.ir` → 200, and the new `WhiteboardStage-*.js` asset is fetched only after the board is opened.
- `PUT /api/Room/1/board` with no credential → 401 or 404, never 200.
- **Excalidraw's fonts and locale chunks load.** They must be served from `/assets/`; a miss outside it silently returns `index.html` with a 200 (`room-web/deploy/nginx.conf`). Open the board on production and confirm no request for a `.woff2` or a locale chunk comes back as HTML.
- Give the container ~40 s before judging it, and if the CDN 404s for a minute after the restart, wait rather than change a Traefik label (`docs/ai/GOTCHAS.md:146`).

- [ ] **Step 4: Write the worklog**

Use the `task-worklog` skill. It must state plainly: what was observed in two windows, what was not, that the audience-forgery attempt was covered by unit tests rather than a live attempt if that is what happened, and the accepted limitations from the spec's §10 — a canvas is invisible to a screen reader, board text is not sanitised, last write wins.

- [ ] **Step 5: Propagate anything reusable**

Candidates, if they turned out to be true in practice: Excalidraw under `dir="rtl"` needs an LTR wrapper; a vitest setup can stay in the node environment by keeping the rules pure; `msg.from.permissions.canPublish` is the client-side trust anchor for anything on the data channel.

- [ ] **Step 6: Commit**

```bash
cd /c/Projects/ceo-portal && git add docs/ && git commit -m "docs(room): the whiteboard worklog"
```

---

## Self-Review

**Spec coverage.** §1 → Tasks 1-5. §2 decision 1 → `canDraw = canPublish` (Task 1 Step 3, Task 4 Step 5). Decision 2 → `senderMayDraw` (Task 2) + server gate (Task 4). Decision 3 → Tasks 4-5. Decision 4 → nothing beyond the board is built. §3's four old bugs → each avoided explicitly: no host concept, no peer RPC, byte chunking (Task 2 Step 3 test), debounce cleared on unmount (Task 3 Step 2, Task 5 Step 3). §4 → Task 1 Step 4. §5 → the File Structure table. §6 → Tasks 2-3. §7 → Tasks 2, 4. §8 → Tasks 4-5, request counts verified in Task 5 Step 6. §9's eleven traps → Task 1 Steps 9-11, Task 2's environment choice, Task 4 Step 7, Task 6 Step 3. §10 → recorded in Task 6 Step 4. §11 → the verification steps throughout. §12 → mapped onto six tasks; the spec's steps 1 and 5 are folded into Task 1 because a component nothing mounts cannot be checked, and its 3 and 4 split at the vitest boundary.

**One spec item deliberately not implemented as written:** §4 says the cameras become a strip above the board, mirroring the screen-share layout. Tasks 1-5 replace the stage entirely instead. Reason: `MeetingStage`'s own screen-share branch already owns that layout (`MeetingStage.tsx:49-63`), and threading a second mode through it is a change to a working component for a benefit nobody has asked to see yet. **If the camera strip is wanted, it is a seventh task, not a change to these.** Flagged rather than silently dropped.

**Placeholders:** none. Every code step carries its code; every command carries its expected output. The one branch left open — whether the `process.env` define is needed — has both outcomes written out with the exact trigger (Task 1 Step 10).

**Type consistency:** `BoardElement` is defined once (Task 2) and used by `useWhiteboardSync` and `WhiteboardStage`. `WHITEBOARD_TOPIC` is defined once. `RoomBoardDto(Scene, UpdatedAtUtc)` matches the client's `RoomBoard { scene, updatedAtUtc }`. `RoomBoardRules.MaxSceneLength` is referenced by the handler and the test. `MeetingBar`'s new props (`boardOpen`, `onToggleBoard`) match the call site. `WhiteboardStage`'s props grow from `{ canDraw }` in Task 1 to `{ roomId, canDraw }` in Task 5, and Task 5 Step 4 updates the call site.
