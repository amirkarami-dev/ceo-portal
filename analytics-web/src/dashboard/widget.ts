// Dashboard widget and grid layout types.
// Defined here (per Task 10 binding decisions); Task 16 will import from @/dashboard/widget.

export interface DashboardWidget {
  i: string;
  reportId: string;
  viewIndex?: number;
  title?: string;
  /** Per-widget display override: "chart" | "table"; undefined = report default. */
  viewMode?: "chart" | "table";
}

export interface GridLayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
}

let counter = 0;
function nextId(): string {
  counter += 1;
  return `w_${Date.now().toString(36)}_${counter}`;
}

const COLS = 12;
const W = 4;
const H = 6;

/** Create a widget + its initial grid placement, flowing left→right. */
export function newWidget(
  reportId: string,
  title: string,
  order: number,
): { widget: DashboardWidget; layout: GridLayoutItem } {
  const id = nextId();
  const perRow = Math.floor(COLS / W); // 3 across
  const x = (order % perRow) * W;
  const y = Math.floor(order / perRow) * H;
  return {
    widget: { i: id, reportId, viewIndex: 0, title },
    layout: { i: id, x, y, w: W, h: H, minW: 2, minH: 3 },
  };
}
