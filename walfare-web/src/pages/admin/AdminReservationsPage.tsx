import { useEffect, useMemo, useRef, useState } from "react";
import { Select, Tag, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  walfareApi,
  ReservationStatus,
  type Paged,
  type Reservation,
} from "@/api/walfareApi";
import { queryKeys, useApiQuery } from "@/query";
import { CrudTable, PageHeader } from "@/components/ui";
import { faDigits, faMoney } from "@/lib/jalali";

const STATUS_OPTIONS = [
  { value: ReservationStatus.PendingPayment, label: "در انتظار پرداخت" },
  { value: ReservationStatus.Paid, label: "پرداخت شده" },
  { value: ReservationStatus.Cancelled, label: "لغو شده" },
];

function StatusTag({ status }: { status: ReservationStatus }) {
  switch (status) {
    case ReservationStatus.Paid:
      return <Tag color="green">پرداخت شده</Tag>;
    case ReservationStatus.Cancelled:
      return <Tag>لغو شده</Tag>;
    default:
      return <Tag color="orange">در انتظار</Tag>;
  }
}

/** همه رزروها — the org-wide list with search and status filter. */
export function AdminReservationsPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [status, setStatus] = useState<ReservationStatus | undefined>(undefined);
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

  const query = useApiQuery<Paged<Reservation>>(queryKeys.reservations.admin(params), () =>
    walfareApi.adminReservations(params),
  );

  const previous = useRef<Paged<Reservation> | undefined>(undefined);
  useEffect(() => {
    if (query.data) previous.current = query.data;
  }, [query.data]);
  const paged = query.data ?? previous.current;

  const columns: ColumnsType<Reservation> = [
    {
      title: "مهندس",
      key: "who",
      width: 220,
      render: (_, r) => (
        <>
          <Typography.Text strong style={{ display: "block" }}>
            {r.fullName}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }} dir="ltr">
            {faDigits(r.nationalCode)}
          </Typography.Text>
        </>
      ),
    },
    { title: "استخر", dataIndex: "poolName", key: "poolName", width: 160 },
    { title: "تاریخ", dataIndex: "date", key: "date", width: 110, render: (v: string) => faDigits(v) },
    { title: "موبایل", dataIndex: "mobile", key: "mobile", width: 130, render: (v: string) => faDigits(v) },
    { title: "مبلغ", dataIndex: "amountRials", key: "amountRials", width: 140, render: (v: number) => faMoney(v) },
    {
      title: "کد رهگیری",
      dataIndex: "trackingCode",
      key: "trackingCode",
      width: 130,
      render: (v?: string | null) =>
        v ? faDigits(v) : <Typography.Text type="secondary">—</Typography.Text>,
    },
    {
      title: "وضعیت",
      dataIndex: "status",
      key: "status",
      width: 130,
      render: (v: ReservationStatus) => <StatusTag status={v} />,
    },
  ];

  return (
    <>
      <PageHeader
        title="همه رزروها"
        subtitle={paged ? `${faDigits(paged.total)} رزرو ثبت شده است` : "فهرست رزرو مهندسین"}
      />

      <CrudTable<Reservation>
        columns={columns}
        data={paged?.items}
        loading={query.isFetching}
        error={query.error}
        onRetry={() => void query.refetch()}
        onRefresh={() => void query.refetch()}
        searchable
        searchPlaceholder="جستجو: نام، کد ملی، کد رهگیری…"
        searchValue={searchInput}
        onSearch={setSearchInput}
        toolbarExtra={
          <Select<ReservationStatus>
            allowClear
            placeholder="همه وضعیت‌ها"
            style={{ width: 170 }}
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
        emptyText="رزروی یافت نشد"
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
