// Dev-only probe for step 1 (route: /dev/excalidraw-lang). Excluded from prod.
//
// The whiteboard sets langCode="fa-IR" and still shows English. The locale IS shipped, the string
// IS translated, and the chunk IS served — so reading more minified code is guessing. This mounts
// Excalidraw on its own, with no room, no sync and no login, and reports what the DOM actually says.
import { useEffect, useState } from "react";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
// The same stylesheet the real board loads, in the same order — otherwise this probe would be
// checking a board that is not the one we ship.
import "../whiteboard.css";
import { whiteboardMenu } from "../whiteboardMenu";

/** The exact string the user quoted, and its Persian counterpart from the shipped locale. */
const ENGLISH_HINT = "To move canvas";
const PERSIAN_HINT = "برای حرکت دادن بوم";

export function ExcalidrawLangProbe() {
  const [report, setReport] = useState("measuring…");

  useEffect(() => {
    // Excalidraw loads the locale asynchronously, so give it a moment before reading.
    const timer = setTimeout(() => {
      const text = document.body.innerText;
      const persian = text.includes(PERSIAN_HINT);
      const english = text.includes(ENGLISH_HINT);
      const anyPersian = /[؀-ۿ]/.test(text);

      setReport(
        [
          `persian hint present: ${persian}`,
          `english hint present: ${english}`,
          `any Persian anywhere: ${anyPersian}`,
          `library trigger: ${document.querySelectorAll(".sidebar-trigger").length} (want 0)`,
          `menu/library labels: ${
            [...document.querySelectorAll(".sidebar-trigger__label")]
              .map((e) => e.textContent)
              .join(", ") || "(none)"
          }`,
          `verdict: ${persian ? "LOCALE APPLIED" : english ? "STILL ENGLISH" : "hint not rendered"}`,
        ].join("\n"),
      );
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column" }}>
      <pre
        data-testid="lang-probe"
        style={{ margin: 0, padding: 12, background: "#111", color: "#0f0", fontSize: 13 }}
      >
        {report}
      </pre>
      <div style={{ flex: 1, minHeight: 0 }}>
        <Excalidraw langCode="fa-IR" renderTopRightUI={() => null}>
          {whiteboardMenu()}
        </Excalidraw>
      </div>
    </div>
  );
}

export default ExcalidrawLangProbe;
