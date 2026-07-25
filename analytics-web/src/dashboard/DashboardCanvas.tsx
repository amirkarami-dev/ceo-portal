import { Responsive, WidthProvider, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import type { ReactNode } from "react";
import type { GridLayoutItem } from "./widget";

const ResponsiveGrid = WidthProvider(Responsive);

interface Props {
  layout: GridLayoutItem[];
  editing: boolean;
  onLayoutChange: (next: GridLayoutItem[]) => void;
  children: ReactNode; // one child per layout item, keyed by item.i
}

// The ONLY grid layout in the app — antd Grid/Row/Col is never used here.
export function DashboardCanvas({ layout, editing, onLayoutChange, children }: Props) {
  return (
    <div className="dashboard-canvas" data-testid="dashboard-canvas">
      <ResponsiveGrid
        breakpoints={{ lg: 1200, md: 996, sm: 768, xs: 480 }}
        cols={{ lg: 12, md: 12, sm: 6, xs: 4 }}
        rowHeight={40}
        isDraggable={editing}
        isResizable={editing}
        layouts={{ lg: layout as Layout[] }}
        onLayoutChange={(l) =>
          onLayoutChange(l.map((it) => ({ i: it.i, x: it.x, y: it.y, w: it.w, h: it.h })))
        }
        draggableHandle=".ant-card-head"
      >
        {children}
      </ResponsiveGrid>
    </div>
  );
}
