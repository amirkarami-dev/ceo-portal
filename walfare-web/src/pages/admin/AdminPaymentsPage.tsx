import { useEffect, useMemo, useRef, useState } from "react";
import { App, Button, Popconfirm, Select, Tag, Typography } from "antd";
import { SafetyCertificateOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import {
  walfareApi,
  PaymentStatus,
  type Paged,
  type PaymentTransaction,
} from "@/api/walfareApi";
import { queryKeys, useApiMutation, useApiQuery } from "@/query";
import { CrudTable, PageHeader } from "@/components/ui";
import { faDigits, faMoney } from "@/lib/jalali";

const STATUS_OPTIONS = [
  { value: PaymentStatus.Initiated, label: "آغاز شده" },
  { value: PaymentStatus.Succeeded, label: "موفق" },
  { value: PaymentStatus.Failed, label: "ناموفق" },
];

function StatusTag({ status }: { status: PaymentStatus }) {
  switch (status) {
    case PaymentStatus.Succeeded:
      return <Tag color="green">موفق</Tag>;
    case PaymentStatus.Failed:
      return <Tag color="red">ناموفق</Tag>;
    default:
      return <Tag color="orange">آغاز شده</Tag>;
  }
}

/** پرداخت‌ها — the gateway ledger; every attempt with its bank references. */
export function AdminPaymentsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<PaymentStatus | undefined>(undefined);
  const [searchInput, setSearchInput] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(searchInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const params = useMemo(
    () => ({ status, q: q || undefined, page, pageSize }),
    [status, q, page, pageSize],
  );

  const query = useApiQuery<Paged<PaymentTransaction>>(queryKeys.payments.admin(params), () =>
    walfareApi.adminPayments(params),
  );

  const { message } = App.useApp();

  // Manual verify for a payment the automatic bank callback left unverified. The endpoint always
  // returns the updated row (even when the bank declines), so invalidate always runs and the
  // row refreshes in place — success or not — and we pick the toast from the resulting status.
  const confirm = useApiMutation<number, PaymentTransaction>({
    mutationFn: (id) => walfareApi.confirmPayment(id),
    invalidate: [queryKeys.payments.all()],
    success: null,
    onSuccess: (tx) => {
      if (tx.status === PaymentStatus.Succeeded) {
        void message.success("تراکنش نزد بانک تأیید شد");
      } else {
        void message.warning(tx.description ?? "بانک این تراکنش را تأیید نکرد");
      }
    },
  });

  const previous = useRef<Paged<PaymentTransaction> | undefined>(undefined);
  useEffect(() => {
    if (query.data) previous.current = query.data;
  }, [query.data]);
  const paged = query.data ?? previous.current;

  const columns: ColumnsType<PaymentTransaction> = [
    {
      title: "پرداخت‌کننده",
      key: "payer",
      width: 200,
      render: (_, t) => (
        <>
          <Typography.Text strong style={{ display: "block" }}>
            {t.payerName || "—"}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }} dir="ltr">
            {faDigits(t.payerNationalCode)}
          </Typography.Text>
        </>
      ),
    },
    { title: "مبلغ", dataIndex: "amountRials", key: "amountRials", width: 140, render: (v: number) => faMoney(v) },
    {
      title: "شناسه پرداخت",
      dataIndex: "paymentId",
      key: "paymentId",
      width: 110,
      render: (v: string) => faDigits(v),
    },
    {
      title: "شماره پیگیری",
      dataIndex: "systemTraceAuditNumber",
      key: "stan",
      width: 130,
      render: (v?: string | null) =>
        v ? faDigits(v) : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "شماره ارجاع",
      dataIndex: "retrievalReferenceNumber",
      key: "rrn",
      width: 150,
      render: (v?: string | null) =>
        v ? faDigits(v) : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "کارت",
      dataIndex: "maskedPan",
      key: "maskedPan",
      width: 150,
      render: (v?: string | null) =>
        v ? <span dir="ltr">{v}</span> : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "وضعیت",
      dataIndex: "status",
      key: "status",
      width: 220,
      render: (v: PaymentStatus, t) => (
        <div style={{ maxWidth: 200 }}>
          <StatusTag status={v} />
          {t.description ? (
            // Keep the bank's own message (verify result) visible, not just on hover. Wrap at
            // word boundaries with normal white-space so long Persian text reads correctly.
            <Typography.Text
              type="secondary"
              style={{
                display: "block",
                fontSize: 11,
                marginTop: 4,
                whiteSpace: "normal",
                wordBreak: "break-word",
                lineHeight: 1.6,
              }}
            >
              {t.description}
            </Typography.Text>
          ) : null}
        </div>
      ),
    },
    {
      title: "عملیات",
      key: "actions",
      width: 120,
      render: (_, t) => {
        // Verify is only meaningful for a captured-but-unverified payment — i.e. one that came
        // back with a bank reference. Rows that never reached the bank (init failed, or the bank
        // declined before capture) have no RRN/STAN and nothing to confirm.
        const canConfirm =
          t.status !== PaymentStatus.Succeeded &&
          !!t.retrievalReferenceNumber &&
          !!t.systemTraceAuditNumber;
        if (!canConfirm) return <Typography.Text type="secondary">—</Typography.Text>;
        return (
          <Popconfirm
            title="تأیید تراکنش نزد بانک؟"
            description="پرداخت با شماره ارجاع و پیگیری این تراکنش نزد ایران کیش تأیید می‌شود."
            okText="تأیید"
            cancelText="انصراف"
            onConfirm={() => confirm.mutate(t.id)}
          >
            <Button
              size="small"
              type="primary"
              ghost
              icon={<SafetyCertificateOutlined />}
              loading={confirm.isPending && confirm.variables === t.id}
            >
              تأیید
            </Button>
          </Popconfirm>
        );
      },
    },
  ];

  return (
    <>
      <PageHeader
        title="پرداخت‌ها"
        subtitle={paged ? `${faDigits(paged.total)} تراکنش ثبت شده است` : "دفتر تراکنش‌های درگاه"}
      />

      <CrudTable<PaymentTransaction>
        columns={columns}
        data={paged?.items}
        loading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRefresh={() => void query.refetch()}
        searchable
        searchPlaceholder="جستجو: نام، کد ملی، شناسه، پیگیری…"
        searchValue={searchInput}
        onSearch={setSearchInput}
        toolbarExtra={
          <Select<PaymentStatus>
            allowClear
            placeholder="همه وضعیت‌ها"
            style={{ width: 150 }}
            value={status}
            onChange={(v) => {
              setStatus(v ?? undefined);
              setPage(1);
            }}
            options={STATUS_OPTIONS}
            aria-label="فیلتر وضعیت"
          />
        }
        showActions={false}
        emptyText="تراکنشی یافت نشد"
        pagination={{
          current: page,
          pageSize,
          total: paged?.total ?? 0,
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
