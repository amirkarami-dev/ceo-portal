// PDF export via a print window. jsPDF cannot shape Persian text without a
// bundled font (and still breaks joined letters), so we render a clean RTL
// print document — chart snapshot + data table — and hand it to the browser's
// "Save as PDF" dialog, which shapes Persian perfectly.
import type { QueryResult } from "@/contracts";
import { formatCell, type Dir } from "@/presentation/format";

/** Snapshot the widget's chart (Recharts SVG or ECharts canvas) as an <img> src. */
export function chartSnapshot(root: HTMLElement | null): string | null {
  if (!root) return null;
  const canvas = root.querySelector("canvas");
  if (canvas) {
    try {
      return (canvas as HTMLCanvasElement).toDataURL("image/png");
    } catch {
      return null;
    }
  }
  const svg = root.querySelector("svg.recharts-surface");
  if (svg) {
    const xml = new XMLSerializer().serializeToString(svg);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
  }
  return null;
}

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function exportPdf(
  title: string,
  result: QueryResult,
  chartRoot?: HTMLElement | null,
): void {
  const dir: Dir = document.documentElement.dir === "rtl" ? "rtl" : "ltr";
  const img = chartSnapshot(chartRoot ?? null);
  const head = result.columns.map((c) => `<th>${esc(c.label)}</th>`).join("");
  const body = result.rows
    .map(
      (r) =>
        `<tr>${result.columns
          .map((c) => `<td>${esc(formatCell(r[c.key] ?? null, c.type, dir))}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  const html = `<!doctype html><html dir="${dir}" lang="${dir === "rtl" ? "fa" : "en"}"><head>
<meta charset="utf-8"><title>${esc(title)}</title>
<style>
  body { font-family: Vazirmatn, Tahoma, -apple-system, "Segoe UI", sans-serif; margin: 24px; color: #1c1c1a; }
  h1 { font-size: 18px; margin: 0 0 16px; }
  img { max-width: 100%; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; font-size: 12px; }
  th, td { border: 1px solid #d5d7d2; padding: 6px 10px; text-align: ${dir === "rtl" ? "right" : "left"}; }
  th { background: #f0f2ef; }
  @media print { body { margin: 0; } }
</style></head><body>
<h1>${esc(title)}</h1>
${img ? `<img src="${img}" alt="">` : ""}
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<script>window.addEventListener("load",function(){setTimeout(function(){window.print()},150)});</script>
</body></html>`;

  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
    return;
  }
  // Popup blocked — print through a hidden same-document iframe instead.
  const frame = document.createElement("iframe");
  frame.style.position = "fixed";
  frame.style.right = "100%";
  frame.style.bottom = "100%";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return;
  }
  doc.open();
  doc.write(html.replace("window.print()", "window.print();parent.postMessage('pdf-print-done','*')"));
  doc.close();
  const cleanup = (e: MessageEvent) => {
    if (e.data === "pdf-print-done") {
      window.removeEventListener("message", cleanup);
      setTimeout(() => frame.remove(), 500);
    }
  };
  window.addEventListener("message", cleanup);
}
