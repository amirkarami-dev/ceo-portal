import { useState } from "react";
import { Button, Card, Empty, Input, Select, Space, Table, Tooltip, Typography } from "antd";
import { ClearOutlined, FilePdfOutlined } from "@ant-design/icons";
import { useLogs } from "../../lib/queries";
import type { LogsFilter, MunReportLogDto } from "../../lib/types";
import { PageHeader } from "../../components/PageHeader";
import { LogStatusTag } from "../../components/StatusTag";
import { absoluteTime, relativeTime, reportPdfUrl } from "../../lib/format";

const EMPTY: LogsFilter = { page: 1, pageSize: 50 };

export function LogsPage() {
  const [filter, setFilter] = useState<LogsFilter>(EMPTY);
  const { data, isLoading } = useLogs(filter);

  const hasFilters = Boolean(filter.workerType || filter.status || filter.peygiri || filter.projectNo);

  return (
    <div>
      <PageHeader
        title="تاریخچه ارسال‌ها"
        subtitle="همه تلاش‌های ارسال به سامانه شهرداری، همراه با وضعیت و خطا"
      />

      <Card>
        <Space wrap size={12} style={{ marginBottom: 16 }}>
          <Select
            allowClear
            value={filter.workerType}
            placeholder="نوع عملیات"
            style={{ width: 200 }}
            options={[
              { value: "SaveEngineerReport", label: "گزارش مهندس ناظر" },
              { value: "SaveEngMap", label: "نقشه مهندسین" },
            ]}
            onChange={(workerType) => setFilter((f) => ({ ...f, workerType, page: 1 }))}
          />
          <Select
            allowClear
            value={filter.status}
            placeholder="وضعیت"
            style={{ width: 150 }}
            options={[
              { value: "Success", label: "موفق" },
              { value: "Failed", label: "ناموفق" },
            ]}
            onChange={(status) => setFilter((f) => ({ ...f, status, page: 1 }))}
          />
          <Input.Search
            placeholder="جستجوی پیگیری"
            allowClear
            style={{ width: 210 }}
            onSearch={(peygiri) => setFilter((f) => ({ ...f, peygiri: peygiri || undefined, page: 1 }))}
          />
          <Input.Search
            placeholder="جستجوی شماره پروژه"
            allowClear
            style={{ width: 210 }}
            onSearch={(projectNo) => setFilter((f) => ({ ...f, projectNo: projectNo || undefined, page: 1 }))}
          />
          {hasFilters && (
            <Button icon={<ClearOutlined />} onClick={() => setFilter(EMPTY)}>
              پاک‌سازی
            </Button>
          )}
        </Space>

        <Table<MunReportLogDto>
          rowKey="id"
          loading={isLoading}
          dataSource={data?.items ?? []}
          scroll={{ x: "max-content" }}
          locale={{ emptyText: <Empty description="رکوردی یافت نشد" image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          pagination={{
            current: filter.page ?? 1,
            pageSize: filter.pageSize ?? 50,
            total: data?.total ?? 0,
            showSizeChanger: true,
            showTotal: (t) => `${t.toLocaleString("fa-IR")} رکورد`,
            onChange: (page, pageSize) => setFilter((f) => ({ ...f, page, pageSize })),
          }}
          columns={[
            { title: "پیگیری", dataIndex: "peygiri", render: (v: string) => <span className="mono">{v}</span> },
            { title: "شماره پروژه", dataIndex: "projectNo", render: (v: string) => <span className="mono">{v}</span> },
            { title: "کد ملک", dataIndex: "reqId", render: (v: string) => <span className="mono">{v}</span> },
            {
              title: "وضعیت",
              dataIndex: "status",
              render: (status: MunReportLogDto["status"]) => <LogStatusTag status={status} />,
            },
            { title: "تلاش", dataIndex: "attemptNumber", align: "center", width: 70 },
            {
              title: "شناسه ثبت",
              dataIndex: "remoteSubmissionId",
              render: (v: string | null) =>
                v ? <span className="mono">{v}</span> : <Typography.Text type="secondary">—</Typography.Text>,
            },
            {
              title: "خطا",
              dataIndex: "errorMessage",
              render: (v: string | null) =>
                v ? (
                  <Tooltip title={v}>
                    <Typography.Text type="danger" ellipsis style={{ maxWidth: 240 }}>
                      {v}
                    </Typography.Text>
                  </Tooltip>
                ) : (
                  <Typography.Text type="secondary">—</Typography.Text>
                ),
            },
            {
              title: "زمان",
              dataIndex: "startedAt",
              render: (v: string) => (
                <Tooltip title={absoluteTime(v)}>
                  <span>{relativeTime(v)}</span>
                </Tooltip>
              ),
            },
            {
              title: "گزارش",
              key: "pdf",
              align: "center",
              width: 110,
              render: (_: unknown, row: MunReportLogDto) =>
                row.status === "Success" ? (
                  <a href={reportPdfUrl(row.peygiri)} target="_blank" rel="noopener noreferrer">
                    <Button type="link" size="small" icon={<FilePdfOutlined />}>
                      دانلود
                    </Button>
                  </a>
                ) : (
                  <Typography.Text type="secondary">—</Typography.Text>
                ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
