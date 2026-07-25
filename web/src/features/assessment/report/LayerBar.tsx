import type { EnvReportLayer } from "@mabhas19/assessment-core"

// A fixed per-category palette so the same material family reads the same color across
// assemblies (mirrors the legacy report's colored layer strip).
const CATEGORY_COLORS: Record<string, string> = {
  g1: "#64748b",
  g2: "#0ea5e9",
  g3: "#a855f7",
  g4: "#b45309",
  g5: "#78716c",
  g6: "#8b5cf6",
  g7: "#14b8a6",
  g8: "#0891b2",
  g9: "#ea580c",
  g10: "#16a34a",
  g11: "#dc2626",
  g12: "#3b82f6",
  g13: "#9333ea",
}
const FALLBACK = "#94a3b8"

// Short, legible label for a segment: the material's first word.
const shortLabel = (material: string) => material.split(/[\s(（]/)[0] || material

/** Proportional, colored strip of the assembly's layers (width ∝ thickness). */
export function LayerBar({ layers }: { layers: EnvReportLayer[] }) {
  if (layers.length === 0) return null

  const widths = layers.map((l) => (l.thickness && l.thickness > 0 ? l.thickness : 0))
  const total = widths.reduce((s, w) => s + w, 0)
  // When no thickness is known, fall back to equal shares.
  const pct = (i: number) =>
    total > 0 ? (widths[i] / total) * 100 : 100 / layers.length

  return (
    <div className="mt-3 flex h-7 w-full overflow-hidden rounded-md ring-1 ring-slate-200">
      {layers.map((layer, i) => {
        const w = pct(i)
        return (
          <div
            key={layer.index}
            className="flex items-center justify-center overflow-hidden whitespace-nowrap px-1 text-[10px] font-medium text-white/95"
            style={{
              width: `${w}%`,
              background: CATEGORY_COLORS[layer.categoryKey] ?? FALLBACK,
            }}
            title={`${layer.material}${layer.thickness ? ` — ${layer.thickness}mm` : ""}`}
          >
            {w > 7 ? shortLabel(layer.material) : ""}
          </div>
        )
      })}
    </div>
  )
}
