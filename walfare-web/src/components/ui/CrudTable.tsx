import { useMemo, useState, type Key, type ReactNode } from "react";
import { Alert, Button, Flex, Input, Popconfirm, Space, Table, Tooltip, Typography } from "antd";
import type { ColumnsType, TableProps } from "antd/es/table";
import { DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { EmptyState } from "./EmptyState";
import { ErrorState } from "./ErrorState";
import { Loading } from "./Loading";

/** Server-side paging descriptor. Omit for client-side paging. */
export interface CrudTablePagination {
  current: number;
  pageSize: number;
  total: number;
  onChange: (page: number, pageSize: number) => void;
  showSizeChanger?: boolean;
}

export interface CrudTableProps<T extends object> {
  /** Data columns only — the actions column is appended automatically. */
  columns: ColumnsType<T>;
  data?: T[];
  loading?: boolean;
  error?: unknown;
  /** Defaults to "id". */
  rowKey?: string | ((record: T) => Key);

  /** Toolbar ------------------------------------------------------------- */
  /** Show the search box (default false). */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Controlled search text. Required for server-side search. */
  searchValue?: string;
  /** When provided, searching is SERVER-side: the table does not filter locally. */
  onSearch?: (value: string) => void;
  /** Fields used by the built-in client-side filter. Defaults to every string field. */
  searchFields?: (keyof T)[];
  /** Rendered when the create button should exist. */
  onCreate?: () => void;
  createLabel?: string;
  /** Extra toolbar content, left of the create button. */
  toolbarExtra?: ReactNode;
  onRefresh?: () => void;

  /** Row actions ---------------------------------------------------------- */
  onEdit?: (record: T) => void;
  onDelete?: (record: T) => void | Promise<void>;
  deleteConfirmTitle?: string | ((record: T) => string);
  /**
   * Line under the confirm title. Defaults to "this cannot be undone", which is NOT true
   * everywhere — a guesthouse with requests is deactivated rather than removed, and telling an
   * admin otherwise would be a lie at the exact moment they decide.
   */
  deleteConfirmDescription?: string | ((record: T) => string);
  deleting?: boolean;
  /** Extra buttons rendered BEFORE edit/delete in the actions cell. */
  rowActions?: (record: T) => ReactNode;
  showActions?: boolean;
  actionsWidth?: number;

  /** Empty / error -------------------------------------------------------- */
  emptyText?: ReactNode;
  emptyAction?: ReactNode;
  onRetry?: () => void;

  /** Table ---------------------------------------------------------------- */
  pagination?: false | CrudTablePagination;
  /** Client-side page size (ignored when `pagination` is given). Default 10. */
  pageSize?: number;
  size?: "small" | "middle" | "large";
  scrollX?: number;
  /** Nested rows. */
  expandable?: TableProps<T>["expandable"];
}

function matches<T extends object>(record: T, query: string, fields?: (keyof T)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const values = fields
    ? fields.map((f) => record[f])
    : (Object.values(record) as unknown[]);
  return values.some((v) => typeof v === "string" && v.toLowerCase().includes(q));
}

/**
 * The workhorse list view: AntD `Table` + toolbar (search / create / refresh) + edit and
 * `Popconfirm`-guarded delete actions, with skeleton, empty and error states baked in.
 *
 * Client-side paging + search by default; pass `pagination` (and `onSearch`/`searchValue`)
 * to drive both from the server.
 */
export function CrudTable<T extends object>({
  columns,
  data,
  loading,
  error,
  rowKey = "id",
  searchable = false,
  searchPlaceholder = "جستجو…",
  searchValue,
  onSearch,
  searchFields,
  onCreate,
  createLabel = "افزودن",
  toolbarExtra,
  onRefresh,
  onEdit,
  onDelete,
  deleteConfirmTitle = "حذف این مورد؟",
  deleteConfirmDescription = "این عمل قابل بازگشت نیست.",
  deleting,
  rowActions,
  showActions = true,
  actionsWidth = 120,
  emptyText,
  emptyAction,
  onRetry,
  pagination,
  pageSize = 10,
  size = "middle",
  scrollX,
  expandable,
}: CrudTableProps<T>) {
  const [localQuery, setLocalQuery] = useState("");
  const serverSearch = typeof onSearch === "function";
  const query = serverSearch ? (searchValue ?? "") : localQuery;

  const rows = useMemo(() => {
    if (!data) return [];
    if (serverSearch || !localQuery) return data;
    return data.filter((r) => matches(r, localQuery, searchFields));
  }, [data, localQuery, searchFields, serverSearch]);

  const hasActions = showActions && (!!onEdit || !!onDelete || !!rowActions);

  const allColumns: ColumnsType<T> = hasActions
    ? [
        ...columns,
        {
          title: "عملیات",
          key: "__actions",
          width: actionsWidth,
          align: "center",
          fixed: scrollX ? "right" : undefined,
          render: (_: unknown, record: T) => (
            <Space size={0}>
              {rowActions?.(record)}
              {onEdit ? (
                <Tooltip title="ویرایش">
                  <Button
                    type="text"
                    aria-label="ویرایش"
                    icon={<EditOutlined />}
                    onClick={() => onEdit(record)}
                  />
                </Tooltip>
              ) : null}
              {onDelete ? (
                <Popconfirm
                  title={
                    typeof deleteConfirmTitle === "function"
                      ? deleteConfirmTitle(record)
                      : deleteConfirmTitle
                  }
                  description={
                    typeof deleteConfirmDescription === "function"
                      ? deleteConfirmDescription(record)
                      : deleteConfirmDescription
                  }
                  okText="حذف"
                  okButtonProps={{ danger: true, loading: deleting }}
                  cancelText="انصراف"
                  onConfirm={() => onDelete(record)}
                >
                  <Tooltip title="حذف">
                    <Button type="text" danger aria-label="حذف" icon={<DeleteOutlined />} />
                  </Tooltip>
                </Popconfirm>
              ) : null}
            </Space>
          ),
        },
      ]
    : columns;

  const toolbar =
    searchable || onCreate || toolbarExtra || onRefresh ? (
      <Flex align="center" justify="space-between" gap={12} wrap style={{ marginBottom: 12 }}>
        <Space wrap>
          {searchable ? (
            <Input.Search
              allowClear
              placeholder={searchPlaceholder}
              style={{ width: 260 }}
              value={query}
              onChange={(e) =>
                serverSearch ? onSearch?.(e.target.value) : setLocalQuery(e.target.value)
              }
              onSearch={(v) => (serverSearch ? onSearch?.(v) : setLocalQuery(v))}
            />
          ) : null}
          {toolbarExtra}
        </Space>
        <Space>
          {onRefresh ? (
            <Tooltip title="به‌روزرسانی">
              <Button
                aria-label="به‌روزرسانی"
                icon={<ReloadOutlined />}
                onClick={onRefresh}
                loading={loading}
              />
            </Tooltip>
          ) : null}
          {onCreate ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
              {createLabel}
            </Button>
          ) : null}
        </Space>
      </Flex>
    ) : null;

  // Only take over the screen when there is NOTHING to show. React Query keeps `data` and sets
  // `error` when a BACKGROUND refetch fails, and refetchOnReconnect is on by default — so
  // gating on `error` alone replaced a perfectly good table, on every admin page at once, the
  // moment the network blinked. A stale list is still worth more than an error screen; the
  // banner below says so out loud rather than hiding it.
  if (error && !data) {
    return (
      <>
        {toolbar}
        <ErrorState error={error} onRetry={onRetry} />
      </>
    );
  }

  // First load: a skeleton reads better than an empty table with a spinner on top.
  if (loading && !data) {
    return (
      <>
        {toolbar}
        <Loading rows={6} />
      </>
    );
  }

  const tablePagination =
    pagination === false
      ? (false as const)
      : pagination
        ? {
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: pagination.showSizeChanger ?? false,
            onChange: pagination.onChange,
            showTotal: (total: number) => `${total.toLocaleString("fa-IR")} مورد`,
          }
        : {
            pageSize,
            hideOnSinglePage: true,
            showSizeChanger: false,
          };

  return (
    <>
      {toolbar}
      {error ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          message="به‌روزرسانی فهرست ناموفق بود؛ آنچه می‌بینید ممکن است تازه نباشد."
        />
      ) : null}
      <Table<T>
        columns={allColumns}
        dataSource={rows}
        loading={loading}
        rowKey={rowKey}
        size={size}
        pagination={tablePagination}
        expandable={expandable}
        // Default to scrolling rather than squeezing: on a phone a 6-column table would
        // otherwise crush every cell to a couple of characters per line.
        scroll={{ x: scrollX ?? "max-content" }}
        locale={{
          emptyText: (
            <EmptyState
              description={emptyText ?? <Typography.Text type="secondary">موردی یافت نشد</Typography.Text>}
              action={emptyAction}
            />
          ),
        }}
      />
    </>
  );
}
