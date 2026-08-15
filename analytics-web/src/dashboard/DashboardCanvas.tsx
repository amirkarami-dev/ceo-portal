import { Responsive, WidthProvider, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import { useRef, type ReactNode } from "react";
import type { GridLayoutItem } from "./widget";

const ResponsiveGrid = WidthProvider(Responsive);

// The width a dashboard is designed at. Narrower screens still render, but the
// layout they render is derived, not the saved one — see onBreakpointChange below.
const DESIGN_COLS = 12;

interface Props {
  layout: GridLayoutItem[];
  editing: boolean;
  onLayoutChange: (next: GridLayoutItem[]) => void;
  children: ReactNode; // one child per layout item, keyed by item.i
}

// The ONLY grid layout in the app — antd Grid/Row/Col is never used here.
export function DashboardCanvas({ layout, editing, onLayoutChange, children }: Props) {
  // Only one layout is stored per dashboard, so a narrow screen must not write
  // back what it renders: react-grid-layout squeezes the 12-column design into
  // 6 (sm) or 4 (xs) columns and reports that through onLayoutChange. Saving
  // after that replaced the design with its squeezed copy for everyone.
  const colsRef = useRef(DESIGN_COLS);

  return (
    <div
      className={`dashboard-canvas${editing ? "" : " dashboard-canvas--readonly"}`}
      data-testid="dashboard-canvas"
    >
      <ResponsiveGrid
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
        cols={{ lg: DESIGN_COLS, md: DESIGN_COLS, sm: 6, xs: 4 }}
        rowHeight={40}
        isDraggable={editing}
        isResizable={editing}
        layouts={{ lg: layout as Layout[] }}
        // Fires immediately before the onLayoutChange that carries the squeezed
        // layout, so the guard below sees the new column count in time.
        onBreakpointChange={(_breakpoint, cols) => {
          colsRef.current = cols;
        }}
        onLayoutChange={(l) => {
          if (colsRef.current !== DESIGN_COLS) return;
          /**
           * Never write back a layout react-grid-layout **invented**.
           *
           * RGL assigns `w:1, h:1` to any child it has no layout entry for. While `layout` is still
           * empty — the dashboard's data has not arrived yet, and the page starts at `useState([])`
           * — every child is such a child, so RGL reports a grid of 1x1 stubs and this handler
           * saved it over the real design before that design was ever applied. Every widget on
           * every dashboard rendered 159x40, and the saved layout in storage stayed correct the
           * whole time, which is what made it look like a rendering bug.
           *
           * The `colsRef` guard above does not catch this: it fires on a breakpoint change, and on
           * first paint there has not been one, so `12 === 12` lets the invention through.
           */
          if (layout.length === 0) return;
          onLayoutChange(l.map((it) => ({ i: it.i, x: it.x, y: it.y, w: it.w, h: it.h })));
        }}
        draggableHandle=".ant-card-head"
      >
        {children}
      </ResponsiveGrid>
    </div>
  );
}
