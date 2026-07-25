import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button, Col, Row, Segmented, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckCircleOutlined,
  InboxOutlined,
  MailOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { contactApi } from "@/api/endpoints";
import type { ContactListParams, ContactMessage, Paged } from "@/api/types";
import { CrudTable, PageHeader, StatCard } from "@/components/ui";
import { formatDateTime, formatNumber, truncate } from "@/lib/format";
import { queryKeys, useApiMutation, useApiQuery } from "@/query";

/** The three states of the "خوانده شده" filter. */
type ReadFilter = "all" | "unread" | "read";

const FILTER_OPTIONS: { label: string; value: ReadFilter }[] = [
  { label: "همه", value: "all" },
  { label: "خوانده‌نشده", value: "unread" },
  { label: "خوانده‌شده", value: "read" },
];

/** `undefined` = no `isRead` query param at all (i.e. "همه"). */
function isReadOf(filter: ReadFilter): boolean | undefined {
  if (filter === "unread") return false;
  if (filter === "read") return true;
  return undefined;
}

/** Phone numbers read as LTR runs even inside the RTL table. */
function Ltr({ children }: { children: ReactNode }) {
  return (
    <span style={{ direction: "ltr", unicodeBidi: "embed", display: "inline-block" }}>
      {children}
    </span>
  );
}

/** A single count, fetched with the smallest page the API will serve. */
function useContactCount(isRead?: boolean) {
  const params: ContactListParams = { isRead, page: 1, pageSize: 1 };
  return useApiQuery<Paged<ContactMessage>>(queryKeys.contactMessages.list(params), () =>
    contactApi.list(params),
  );
}

export function MessagesPage() {
  const [filter, setFilter] = useState<ReadFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const params: ContactListParams = useMemo(
    () => ({ isRead: isReadOf(filter), page, pageSize }),
    [filter, page, pageSize],
  );

  // Paging/filtering changes the query key, so `data` would briefly be undefined and the table
  // would flash its skeleton. Feeding the last page back as placeholder keeps the rows on screen
  // (with the table's own loading overlay) until the new page lands.
  const [lastPage, setLastPage] = useState<Paged<ContactMessage>>();

  const query = useApiQuery<Paged<ContactMessage>>(
    queryKeys.contactMessages.list(params),
    () => contactApi.list(params),
    { placeholderData: lastPage },
  );

  useEffect(() => {
    if (query.data) setLastPage(query.data);
  }, [query.data]);

  const totalCount = useContactCount();
  const unreadCount = useContactCount(false);

  // Deleting the last row of the last page would otherwise leave us on an empty page.
  const totalPages = query.data?.totalPages ?? 0;
  useEffect(() => {
    if (totalPages > 0 && page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const setRead = useApiMutation<{ id: number; isRead: boolean }>({
    mutationFn: ({ id, isRead }) => contactApi.setRead(id, isRead),
    invalidate: [queryKeys.contactMessages.all()],
    success: "وضعیت پیام به‌روزرسانی شد",
  });

  const remove = useApiMutation<number>({
    mutationFn: (id) => contactApi.remove(id),
    invalidate: [queryKeys.contactMessages.all()],
    success: "پیام حذف شد",
  });

  const columns: ColumnsType<ContactMessage> = [
    {
      title: "نام",
      dataIndex: "name",
      key: "name",
      width: 160,
      render: (_: unknown, record) => (
        <Typography.Text strong={!record.isRead}>{record.name || "—"}</Typography.Text>
      ),
    },
    {
      title: "تلفن",
      dataIndex: "phone",
      key: "phone",
      width: 140,
      render: (value: string) => (value ? <Ltr>{value}</Ltr> : "—"),
    },
    {
      title: "موضوع",
      dataIndex: "subject",
      key: "subject",
      render: (_: unknown, record) => (
        <Tooltip title={record.subject || undefined}>
          <Typography.Text strong={!record.isRead}>{truncate(record.subject, 70)}</Typography.Text>
        </Tooltip>
      ),
    },
    {
      title: "تاریخ",
      dataIndex: "created",
      key: "created",
      width: 170,
      render: (value: string) => (
        <Typography.Text type="secondary">{formatDateTime(value)}</Typography.Text>
      ),
    },
    {
      title: "وضعیت",
      dataIndex: "isRead",
      key: "isRead",
      width: 120,
      align: "center",
      render: (isRead: boolean) =>
        isRead ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>
            خوانده‌شده
          </Tag>
        ) : (
          <Tag color="blue" icon={<MailOutlined />}>
            خوانده‌نشده
          </Tag>
        ),
    },
  ];

  return (
    <>
      <PageHeader
        title="پیام‌ها"
        subtitle="پیام‌های دریافتی از فرم تماس با ما"
        actions={
          <Segmented<ReadFilter>
            options={FILTER_OPTIONS}
            value={filter}
            onChange={(value) => {
              setFilter(value);
              setPage(1);
            }}
          />
        }
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            label="کل پیام‌ها"
            value={formatNumber(totalCount.data?.total ?? 0)}
            icon={<InboxOutlined />}
            loading={totalCount.isLoading}
            hint="برای نمایش همه کلیک کنید"
            onClick={() => {
              setFilter("all");
              setPage(1);
            }}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <StatCard
            label="خوانده‌نشده"
            value={formatNumber(unreadCount.data?.total ?? 0)}
            icon={<MailOutlined />}
            tone="amber"
            loading={unreadCount.isLoading}
            hint="برای فیلتر کلیک کنید"
            onClick={() => {
              setFilter("unread");
              setPage(1);
            }}
          />
        </Col>
      </Row>

      <CrudTable<ContactMessage>
        columns={columns}
        data={query.data?.items}
        loading={query.isLoading || query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRefresh={() => void query.refetch()}
        onDelete={(record) => remove.mutateAsync(record.id).catch(() => undefined)}
        deleteConfirmTitle={(record) => `حذف پیام «${truncate(record.subject, 30)}»؟`}
        deleting={remove.isPending}
        actionsWidth={140}
        rowActions={(record) => (
          <Tooltip title={record.isRead ? "علامت‌گذاری به‌عنوان خوانده‌نشده" : "علامت‌گذاری به‌عنوان خوانده‌شده"}>
            <Button
              type="text"
              aria-label={record.isRead ? "خوانده‌نشده" : "خوانده‌شده"}
              loading={setRead.isPending && setRead.variables?.id === record.id}
              icon={record.isRead ? <UndoOutlined /> : <CheckCircleOutlined />}
              onClick={() =>
                void setRead
                  .mutateAsync({ id: record.id, isRead: !record.isRead })
                  .catch(() => undefined)
              }
            />
          </Tooltip>
        )}
        expandable={{
          expandedRowRender: (record) => (
            <div style={{ padding: "4px 8px 8px" }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                متن پیام
              </Typography.Text>
              <Typography.Paragraph
                style={{ whiteSpace: "pre-wrap", marginTop: 6, marginBottom: 0 }}
                copyable={record.message ? { text: record.message } : false}
              >
                {record.message?.trim() ? record.message : "—"}
              </Typography.Paragraph>
            </div>
          ),
          rowExpandable: () => true,
        }}
        emptyText={
          filter === "unread"
            ? "پیام خوانده‌نشده‌ای وجود ندارد"
            : filter === "read"
              ? "پیام خوانده‌شده‌ای وجود ندارد"
              : "هنوز پیامی دریافت نشده است"
        }
        pagination={{
          // Driven by local state, not the server echo — while a page is in flight the placeholder
          // still carries the PREVIOUS page number, which would make the pager jump back and forth.
          current: page,
          pageSize,
          total: query.data?.total ?? 0,
          showSizeChanger: true,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
        scrollX={900}
      />
    </>
  );
}

export default MessagesPage;
