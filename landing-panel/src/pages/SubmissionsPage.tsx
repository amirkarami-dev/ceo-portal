import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { App, Button, Descriptions, Select, Space, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CheckOutlined,
  DownloadOutlined,
  FileExcelOutlined,
  PaperClipOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import { formsApi, submissionsApi } from "@/api/endpoints";
import type { FormSubmission, Paged, SiteForm, SubmissionListParams } from "@/api/types";
import { CrudTable, PageHeader } from "@/components/ui";
import { queryKeys, useApiMutation, useApiQuery } from "@/query";
import { errorMessage } from "@/api/client";
import { formatBytes, formatDateTime, formatNumber, truncate } from "@/lib/format";
import {
  buildExportTable,
  downloadCsv,
  downloadXlsx,
  fetchAllSubmissions,
  MAX_EXPORT_ROWS,
} from "@/lib/submissionExport";

type HandledFilter = "all" | "handled" | "pending";

const HANDLED_OPTIONS: { value: HandledFilter; label: string }[] = [
  { value: "all", label: "همه وضعیت‌ها" },
  { value: "pending", label: "در انتظار رسیدگی" },
  { value: "handled", label: "رسیدگی‌شده" },
];

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

  /**
   * Exports EVERY row the current filters match, not the page on screen.
   *
   * The old CSV button exported `rows` — one page — and named the file `submissions-page-3.csv`,
   * so an administrator who had paged through 400 registrations got the 20 they were looking at.
   * `fetchAllSubmissions` pages the API instead, because the server clamps pageSize to 100 and
   * says nothing about it.
   */
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);

  const runExport = async (kind: "csv" | "xlsx") => {
    if (total === 0) {
      message.warning("موردی برای خروجی گرفتن وجود ندارد");
      return;
    }

    setExporting(kind);
    const hide = message.loading("در حال آماده‌سازی خروجی…", 0);
    try {
      const { submissions, truncated } = await fetchAllSubmissions({
        formId,
        handled: handledToParam(handled),
      });

      if (submissions.length === 0) {
        message.warning("موردی برای خروجی گرفتن وجود ندارد");
        return;
      }

      const table = buildExportTable(submissions, forms, formTitleOf);
      const stamp = new Date().toISOString().slice(0, 10);
      const name = `submissions-${formId ? `form-${formId}-` : ""}${stamp}`;

      if (kind === "xlsx") await downloadXlsx(table, `${name}.xlsx`);
      else downloadCsv(table, `${name}.csv`);

      // Say how many rows are really in the file. Silence here is what let the old button look
      // like it had exported everything.
      if (truncated) {
        message.warning(
          `${formatNumber(submissions.length)} ردیف ذخیره شد — به دلیل حجم زیاد، ` +
            `خروجی به ${formatNumber(MAX_EXPORT_ROWS)} ردیف محدود شد.`,
        );
      } else {
        message.success(`${formatNumber(submissions.length)} ردیف در خروجی ذخیره شد`);
      }
    } catch (err) {
      message.error(errorMessage(err, "تهیه خروجی ناموفق بود"));
    } finally {
      hide();
      setExporting(null);
    }
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
            <Button
              type="primary"
              icon={<FileExcelOutlined />}
              loading={exporting === "xlsx"}
              disabled={exporting !== null || total === 0}
              onClick={() => void runExport("xlsx")}
            >
              خروجی اکسل
            </Button>
            <Button
              icon={<DownloadOutlined />}
              loading={exporting === "csv"}
              disabled={exporting !== null || total === 0}
              onClick={() => void runExport("csv")}
            >
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
