import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { App, Button, Select, Space, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CheckOutlined, DownloadOutlined, UndoOutlined } from "@ant-design/icons";
import { formsApi, submissionsApi } from "@/api/endpoints";
import type { FormSubmission, Paged, SiteForm, SubmissionListParams } from "@/api/types";
import { CrudTable, PageHeader } from "@/components/ui";
import { queryKeys, useApiMutation, useApiQuery } from "@/query";
import { formatDateTime, formatNumber, truncate } from "@/lib/format";

type HandledFilter = "all" | "handled" | "pending";

const HANDLED_OPTIONS: { value: HandledFilter; label: string }[] = [
  { value: "all", label: "همه وضعیت‌ها" },
  { value: "pending", label: "در انتظار رسیدگی" },
  { value: "handled", label: "رسیدگی‌شده" },
];

const CSV_HEADERS = [
  "فرم",
  "نام و نام خانوادگی",
  "کد ملی",
  "شماره عضویت",
  "موبایل",
  "توضیحات",
  "تاریخ ثبت",
  "وضعیت",
];

/** RFC-4180 cell: wrap in quotes, double any inner quote. */
function csvCell(value: string): string {
  return `"${(value ?? "").replace(/"/g, '""')}"`;
}

function handledToParam(filter: HandledFilter): boolean | undefined {
  if (filter === "handled") return true;
  if (filter === "pending") return false;
  return undefined;
}

export function SubmissionsPage() {
  const { message } = App.useApp();
  const [searchParams, setSearchParams] = useSearchParams();

  // Deep link from the forms page: /submissions?formId=12
  const formIdParam = Number(searchParams.get("formId"));
  const [formId, setFormId] = useState<number | undefined>(
    Number.isFinite(formIdParam) && formIdParam > 0 ? formIdParam : undefined,
  );
  const [handled, setHandled] = useState<HandledFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const params: SubmissionListParams = useMemo(
    () => ({ formId, handled: handledToParam(handled), page, pageSize }),
    [formId, handled, page, pageSize],
  );

  const query = useApiQuery<Paged<FormSubmission>>(queryKeys.submissions.list(params), () =>
    submissionsApi.list(params),
  );

  // Keep the previous page on screen while the next one loads (no skeleton flash on paging).
  const [snapshot, setSnapshot] = useState<Paged<FormSubmission>>();
  useEffect(() => {
    if (query.data) setSnapshot(query.data);
  }, [query.data]);
  const paged = query.data ?? snapshot;
  const rows = useMemo(() => paged?.items ?? [], [paged]);

  const formsQuery = useApiQuery<SiteForm[]>(queryKeys.forms.list(), formsApi.list);
  const forms = useMemo(() => formsQuery.data ?? [], [formsQuery.data]);

  const formTitleOf = (record: FormSubmission): string =>
    record.formTitle ?? forms.find((f) => f.id === record.formId)?.title ?? `فرم #${record.formId}`;

  const setHandledMutation = useApiMutation<{ id: number; isHandled: boolean }>({
    mutationFn: ({ id, isHandled }) => submissionsApi.setHandled(id, isHandled),
    invalidate: [queryKeys.submissions.all()],
    success: "وضعیت رسیدگی به‌روزرسانی شد",
  });

  const removeMutation = useApiMutation<number>({
    mutationFn: (id) => submissionsApi.remove(id),
    // The form's submissionCount changes too.
    invalidate: [queryKeys.submissions.all(), queryKeys.forms.all()],
    success: "ثبت‌نام حذف شد",
  });

  const togglingId =
    setHandledMutation.isPending && setHandledMutation.variables
      ? setHandledMutation.variables.id
      : null;

  const changeFormId = (value?: number) => {
    setFormId(value);
    setPage(1);
    const next = new URLSearchParams(searchParams);
    if (value) next.set("formId", String(value));
    else next.delete("formId");
    setSearchParams(next, { replace: true });
  };

  const changeHandled = (value: HandledFilter) => {
    setHandled(value);
    setPage(1);
  };

  const exportCsv = () => {
    if (!rows.length) {
      message.warning("موردی برای خروجی گرفتن وجود ندارد");
      return;
    }

    const lines = [
      CSV_HEADERS.map(csvCell).join(","),
      ...rows.map((r) =>
        [
          formTitleOf(r),
          r.fullName,
          r.nationalId,
          r.membershipNo,
          r.mobile,
          r.notes ?? "",
          formatDateTime(r.created),
          r.isHandled ? "رسیدگی‌شده" : "در انتظار",
        ]
          .map(csvCell)
          .join(","),
      ),
    ];

    // Leading BOM (U+FEFF) so Excel opens the Persian text as UTF-8.
    const csv = "\uFEFF" + lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `submissions-page-${page}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    message.success(`${formatNumber(rows.length)} ردیف در خروجی CSV ذخیره شد`);
  };

  const columns: ColumnsType<FormSubmission> = [
    {
      title: "فرم",
      dataIndex: "formTitle",
      key: "formTitle",
      width: 190,
      render: (_: unknown, record) => (
        <Typography.Text strong>{formTitleOf(record)}</Typography.Text>
      ),
    },
    {
      title: "نام و نام خانوادگی",
      dataIndex: "fullName",
      key: "fullName",
      width: 170,
    },
    {
      title: "کد ملی",
      dataIndex: "nationalId",
      key: "nationalId",
      width: 130,
      render: (value: string) => (
        <Typography.Text style={{ direction: "ltr", display: "inline-block" }}>
          {value || "—"}
        </Typography.Text>
      ),
    },
    {
      title: "شماره عضویت",
      dataIndex: "membershipNo",
      key: "membershipNo",
      width: 130,
      render: (value: string) => (
        <Typography.Text style={{ direction: "ltr", display: "inline-block" }}>
          {value || "—"}
        </Typography.Text>
      ),
    },
    {
      title: "موبایل",
      dataIndex: "mobile",
      key: "mobile",
      width: 130,
      render: (value: string) =>
        value ? (
          <Typography.Link href={`tel:${value}`} style={{ direction: "ltr", display: "inline-block" }}>
            {value}
          </Typography.Link>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: "توضیحات",
      dataIndex: "notes",
      key: "notes",
      width: 200,
      render: (value: string | null) =>
        value ? (
          <Tooltip title={value}>
            <Typography.Text type="secondary">{truncate(value, 40)}</Typography.Text>
          </Tooltip>
        ) : (
          <Typography.Text type="secondary">—</Typography.Text>
        ),
    },
    {
      title: "تاریخ ثبت",
      dataIndex: "created",
      key: "created",
      width: 170,
      render: (value: string) => formatDateTime(value),
    },
    {
      title: "وضعیت",
      dataIndex: "isHandled",
      key: "isHandled",
      width: 120,
      align: "center",
      render: (_: unknown, record) => (
        <Tag color={record.isHandled ? "green" : "gold"}>
          {record.isHandled ? "رسیدگی‌شده" : "در انتظار"}
        </Tag>
      ),
    },
  ];

  const total = paged?.total ?? 0;

  return (
    <>
      <PageHeader
        title="ثبت‌نام‌ها"
        subtitle={
          query.isLoading
            ? "صندوق ورودی ثبت‌نام فرم‌ها"
            : `${formatNumber(total)} ثبت‌نام با فیلترهای فعلی`
        }
      />

      <CrudTable<FormSubmission>
        columns={columns}
        // `undefined` until the first page lands -> CrudTable shows its skeleton instead of an empty grid.
        data={paged ? rows : undefined}
        loading={query.isLoading || query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRefresh={() => void query.refetch()}
        toolbarExtra={
          <Space wrap>
            <Select<number | undefined>
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="همه فرم‌ها"
              style={{ minWidth: 220 }}
              value={formId}
              loading={formsQuery.isLoading}
              onChange={(value) => changeFormId(value ?? undefined)}
              options={forms.map((f) => ({ value: f.id, label: f.title }))}
            />
            <Select<HandledFilter>
              style={{ minWidth: 170 }}
              value={handled}
              onChange={changeHandled}
              options={HANDLED_OPTIONS}
            />
            <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!rows.length}>
              خروجی CSV
            </Button>
          </Space>
        }
        rowActions={(record) => (
          <Tooltip title={record.isHandled ? "بازگرداندن به در انتظار" : "علامت‌گذاری به‌عنوان رسیدگی‌شده"}>
            <Button
              type="text"
              aria-label={record.isHandled ? "بازگرداندن به در انتظار" : "رسیدگی‌شده"}
              icon={record.isHandled ? <UndoOutlined /> : <CheckOutlined />}
              loading={togglingId === record.id}
              onClick={() =>
                setHandledMutation.mutate({ id: record.id, isHandled: !record.isHandled })
              }
            />
          </Tooltip>
        )}
        onDelete={(record) => removeMutation.mutate(record.id)}
        deleteConfirmTitle={(record) => `ثبت‌نام «${record.fullName}» حذف شود؟`}
        deleting={removeMutation.isPending}
        emptyText={
          formId || handled !== "all"
            ? "با این فیلترها ثبت‌نامی یافت نشد"
            : "هنوز ثبت‌نامی ارسال نشده است"
        }
        actionsWidth={130}
        scrollX={1420}
        pagination={{
          current: paged?.page ?? page,
          pageSize: paged?.pageSize ?? pageSize,
          total,
          showSizeChanger: true,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
          },
        }}
      />
    </>
  );
}

export default SubmissionsPage;
