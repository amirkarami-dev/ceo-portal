import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { HTMLAttributes, ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";

// Data attributes (data-*) are valid HTML but are not in React's HTMLAttributes type;
// we extend with a loose record so callers can pass e.g. { "data-testid": "row" }.
type RowProps = HTMLAttributes<HTMLElement> & Record<string, unknown>;

export function DataTable<T extends object>({
  columns,
  data,
  loading,
  error,
  rowKey,
  empty,
  toolbar,
  pageSize = 10,
  onRow,
}: {
  columns: ColumnsType<T>;
  data?: T[];
  loading?: boolean;
  error?: unknown;
  rowKey: string | ((r: T) => string);
  empty?: ReactNode;
  toolbar?: ReactNode;
  pageSize?: number;
  onRow?: (record: T) => RowProps;
}) {
  if (error) return <ErrorState detail={String((error as Error)?.message ?? error)} />;
  return (
    <>
      {toolbar}
      <Table<T>
        columns={columns}
        dataSource={data}
        loading={loading}
        rowKey={rowKey}
        size="middle"
        pagination={{ pageSize, hideOnSinglePage: true, showSizeChanger: false }}
        locale={{ emptyText: empty ?? <EmptyState /> }}
        onRow={onRow as ((record: T) => HTMLAttributes<HTMLElement>) | undefined}
      />
    </>
  );
}
