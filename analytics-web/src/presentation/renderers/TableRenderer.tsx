import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ReportView } from "../../contracts/presentation";
import type { ReportDefinition } from "../../contracts/report-definition";
import type {
  QueryResult,
  ResultRow,
  ResolvedColumn,
  GroupNode,
} from "../../contracts/dataset";
import { formatCell, type Dir } from "../format";

export type RendererProps = {
  view: ReportView;
  def: ReportDefinition;
  result: QueryResult;
  /** Optional drill callback (Task 13 canonical prop); this renderer uses
   *  expandable rows for drill-down and ignores it. */
  onDrill?: (node: GroupNode) => void;
};

function currentDir(): Dir {
  if (typeof document !== "undefined" && document.documentElement.dir === "rtl") {
    return "rtl";
  }
  return "ltr";
}

function compareBy(col: ResolvedColumn) {
  return (a: ResultRow, b: ResultRow) => {
    const av = a[col.key];
    const bv = b[col.key];
    if (av === null || av === undefined) return -1;
    if (bv === null || bv === undefined) return 1;
    if (col.type === "number") return Number(av) - Number(bv);
    if (col.type === "date") return new Date(String(av)).getTime() - new Date(String(bv)).getTime();
    return String(av).localeCompare(String(bv), "fa");
  };
}

// Stable row key: use the first column's value + row index to avoid antd warnings.
function rowKey(row: ResultRow, index?: number): string {
  const firstVal = Object.values(row)[0];
  return firstVal != null ? String(firstVal) : String(index ?? 0);
}

export default function TableRenderer({ view, result, onDrill }: RendererProps) {
  const dir = currentDir();
  const wanted = view.mapping.columns;
  const cols = wanted
    ? result.columns.filter((c) => wanted.includes(c.key))
    : result.columns;

  const antdColumns: ColumnsType<ResultRow> = cols.map((col) => {
    // Measures hug the reading end; dimensions hug the start (mirrored by dir).
    const align: "left" | "right" = col.isMetric
      ? dir === "rtl"
        ? "left"
        : "right"
      : dir === "rtl"
        ? "right"
        : "left";
    return {
      key: col.key,
      dataIndex: col.key,
      title: col.label,
      align,
      sorter: compareBy(col),
      render: (value: string | number | null) =>
        formatCell(value, col.type, dir),
    };
  });

  // Drill-down: when the engine produced grouped output, expanding a parent
  // row reveals that group's child rows in a nested Table.
  const expandable =
    result.groups && result.groups.length > 0
      ? {
          expandedRowRender: (_record: ResultRow, index: number) => {
            const group: GroupNode | undefined = result.groups?.[index];
            const childRows = group?.rows ?? [];
            return (
              <Table<ResultRow>
                size="small"
                rowKey={rowKey}
                pagination={false}
                columns={antdColumns}
                dataSource={childRows}
              />
            );
          },
          onExpand: (expanded: boolean, record: ResultRow) => {
            const idx = result.rows.indexOf(record);
            const group = result.groups?.[idx];
            if (expanded && onDrill && group) onDrill(group);
          },
          rowExpandable: (record: ResultRow) => {
            const idx = result.rows.indexOf(record);
            return Boolean(result.groups?.[idx]?.rows?.length);
          },
        }
      : undefined;

  return (
    <Table<ResultRow>
      rowKey={rowKey}
      columns={antdColumns}
      dataSource={result.rows}
      expandable={expandable}
      scroll={{ x: "max-content" }}
      pagination={{
        pageSize: 25,
        showSizeChanger: true,
        pageSizeOptions: ["10", "25", "50", "100"],
        total: result.total,
      }}
    />
  );
}
