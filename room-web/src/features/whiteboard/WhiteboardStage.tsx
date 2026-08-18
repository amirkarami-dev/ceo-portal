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
