import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { App, Button, Descriptions, Select, Space, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { CheckOutlined, DownloadOutlined, PaperClipOutlined, UndoOutlined } from "@ant-design/icons";
import { formsApi, submissionsApi } from "@/api/endpoints";
import type { FormSubmission, Paged, SiteForm, SubmissionListParams } from "@/api/types";
import { CrudTable, PageHeader } from "@/components/ui";
import { queryKeys, useApiMutation, useApiQuery } from "@/query";
import { errorMessage } from "@/api/client";
import { formatBytes, formatDateTime, formatNumber, truncate } from "@/lib/format";

type HandledFilter = "all" | "handled" | "pending";

const HANDLED_OPTIONS: { value: HandledFilter; label: string }[] = [
  { value: "all", label: "همه وضعیت‌ها" },
  { value: "pending", label: "در انتظار رسیدگی" },
  { value: "handled", label: "رسیدگی‌شده" },
];

const CSV_HEADERS = ["فرم", "پاسخ‌ها", "فایل‌ها", "تاریخ ثبت", "وضعیت"];

/** Every form has its own fields, so a submission flattens to "label: value" pairs. */
function answersText(record: FormSubmission): string {
  return (record.answers ?? []).map((a) => a.fieldLabel + ": " + a.text).join(" | ");
}

function filesText(record: FormSubmission): string {
  return (record.attachments ?? []).map((a) => a.fileName).join(" | ");
}

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

  /** Which attachment is being fetched, so only that button spins. */
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  /**
   * The download route is admin-only, so the file cannot be a plain link — the bytes are fetched
   * with the access token and handed to the browser as a blob. See `downloadProtectedFile`.
   */
  const download = async (attachmentId: number, fileName: string) => {
    setDownloadingId(attachmentId);
    try {
      await submissionsApi.downloadAttachment(attachmentId, fileName);
    } catch (err) {
      message.error(errorMessage(err, "دریافت فایل ناموفق بود"));
    } finally {
      setDownloadingId(null);
    }
  };

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
          answersText(r),
          filesText(r),
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
      // Every form asks for something different, so there is no fixed set of columns any more.
      // The first two answers give the row an identity; the rest open below.
      title: "پاسخ‌ها",
      key: "answers",
      render: (_: unknown, record) => {
        const answers = record.answers ?? [];
        if (answers.length === 0) {
          return <Typography.Text type="secondary">—</Typography.Text>;
        }
        return (
          <Space direction="vertical" size={0}>
            {answers.slice(0, 2).map((a) => (
              <Typography.Text key={a.fieldId + a.fieldLabel} style={{ fontSize: 13 }}>
                <Typography.Text type="secondary">{a.fieldLabel}: </Typography.Text>
                {truncate(a.text, 40)}
              </Typography.Text>
            ))}
            {answers.length > 2 ? (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                +{formatNumber(answers.length - 2)} مورد دیگر
              </Typography.Text>
            ) : null}
          </Space>
        );
      },
    },
    {
      title: "فایل‌ها",
      key: "attachments",
      width: 120,
      align: "center",
      render: (_: unknown, record) => {
        const count = record.attachments?.length ?? 0;
        return count === 0 ? (
          <Typography.Text type="secondary">—</Typography.Text>
        ) : (
          <Tag icon={<PaperClipOutlined />} color="blue">
            {formatNumber(count)}
          </Tag>
        );
      },
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
        expandable={{
          // Only rows that actually have something to show can be opened.
          rowExpandable: (record) =>
            (record.answers?.length ?? 0) > 0 || (record.attachments?.length ?? 0) > 0,
          expandedRowRender: (record) => (
            <Space direction="vertical" size={12} style={{ width: "100%", paddingInline: 8 }}>
              {(record.answers?.length ?? 0) > 0 ? (
                <Descriptions
                  size="small"
                  column={1}
                  bordered
                  items={(record.answers ?? []).map((a) => ({
                    key: `${a.fieldId}-${a.fieldLabel}`,
                    label: a.fieldLabel,
                    children: a.text || <Typography.Text type="secondary">—</Typography.Text>,
                  }))}
                />
              ) : null}

              {(record.attachments?.length ?? 0) > 0 ? (
                <div>
                  <Typography.Text strong style={{ fontSize: 13 }}>
                    فایل‌های پیوست
                  </Typography.Text>
                  <Space direction="vertical" size={4} style={{ width: "100%", marginTop: 6 }}>
                    {(record.attachments ?? []).map((a) => (
                      <Space key={a.id} size={8} wrap>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {a.fieldLabel}:
                        </Typography.Text>
                        <Button
                          size="small"
                          icon={<DownloadOutlined />}
                          loading={downloadingId === a.id}
                          onClick={() => void download(a.id, a.fileName)}
                        >
                          {a.fileName}
                        </Button>
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                          {formatBytes(a.sizeBytes)}
                        </Typography.Text>
                      </Space>
                    ))}
                  </Space>
                </div>
              ) : null}
            </Space>
          ),
        }}
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
        deleteConfirmTitle={(record) => `ثبت‌نام «${formTitleOf(record)}» حذف شود؟`}
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
