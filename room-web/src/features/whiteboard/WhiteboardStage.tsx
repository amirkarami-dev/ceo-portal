import { useCallback, useEffect, useRef, useState } from "react";
import { theme } from "antd";
import { Excalidraw, reconcileElements } from "@excalidraw/excalidraw";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { OrderedExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { RemoteExcalidrawElement } from "@excalidraw/excalidraw/data/reconcile";
import "@excalidraw/excalidraw/index.css";
import { useThemeMode } from "../../theme/useThemeMode";
import { useRoomBoard, useSaveRoomBoard } from "../../lib/queries";
import { useWhiteboardSync } from "./useWhiteboardSync";
import type { BoardElement } from "./wire";

/** Local edits are gathered for this long before going out, so a stroke is one message not fifty. */
const CHANGE_DEBOUNCE_MS = 150;
/** How long after the last local change the whole board is written to the server. */
const SAVE_DEBOUNCE_MS = 10_000;

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
export function WhiteboardStage({ roomId, canDraw }: { roomId: number; canDraw: boolean }) {
  const { token } = theme.useToken();
  const { mode } = useThemeMode();
  const [api, setApi] = useState<ExcalidrawImperativeAPI | null>(null);
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  apiRef.current = api;

  const { data: saved } = useRoomBoard(roomId, true);
  const save = useSaveRoomBoard(roomId);

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

  // One timer for the component's life, cleared on unmount — an uncancelled debounce firing after
  // the board closes was one of the old implementation's leaks.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * `save.mutate` is stable; the object `useMutation` returns is **not** — it is a fresh literal on
   * every render. Anything that takes the whole object as a dependency re-runs constantly, which is
   * how the flush below once became a request loop: its "cleanup" ran after every render, saw a
   * `saveTimer` that was never cleared after firing, and saved again — each save re-rendering and
   * re-triggering the next.
   */
  const mutateRef = useRef(save.mutate);
  mutateRef.current = save.mutate;

  const flushSave = useCallback(() => {
    saveTimer.current = null; // fired; nothing is pending any more
    const elements = apiRef.current?.getSceneElementsIncludingDeleted() ?? [];
    if (elements.length > 0) mutateRef.current(JSON.stringify({ type: "excalidraw", elements }));
  }, []);

  const flushRef = useRef(flushSave);
  flushRef.current = flushSave;

  const onChange = useCallback(() => {
    if (!canDraw) return;

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      // The save is armed from the RESULT of the broadcast, not from `onChange` itself. Excalidraw
      // fires `onChange` for programmatic updates too, so applying a peer's edit or loading the
      // saved board would otherwise arm a save on a client that has drawn nothing — and in a meeting
      // everybody may draw, so that is everybody.
      if (!broadcastChanged()) return;

      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => flushRef.current(), SAVE_DEBOUNCE_MS);
    }, CHANGE_DEBOUNCE_MS);
  }, [canDraw, broadcastChanged]);

  // Unmount only — an empty dependency list, deliberately. Closing the board must not throw away the
  // last few seconds of drawing, and must not do anything else.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        flushRef.current();
      }
    },
    [],
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
