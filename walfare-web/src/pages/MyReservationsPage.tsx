import { Alert, App, Button, Card, List, Skeleton, Space, Tabs, Tag, Typography } from "antd";
import { CreditCardOutlined, NumberOutlined } from "@ant-design/icons";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  GUESTHOUSE_STATUS_LABELS,
  GuesthouseRequestStatus,
  ReservationStatus,
  walfareApi,
  type GuesthouseRequest,
  type Reservation,
} from "@/api/walfareApi";
import { errorMessage } from "@/api/client";
import { queryKeys, useApiQuery } from "@/query";
import { EmptyState, PageHeader } from "@/components/ui";
import { faDigits, faMoney, faToman } from "@/lib/jalali";

function StatusTag({ status }: { status: ReservationStatus }) {
  switch (status) {
    case ReservationStatus.Paid:
      return <Tag color="green">پرداخت شده</Tag>;
    case ReservationStatus.Cancelled:
      return <Tag>لغو شده</Tag>;
    default:
      return <Tag color="orange">در انتظار پرداخت</Tag>;
  }
}

/** Colour carries the same meaning as the word, never instead of it. */
function GuesthouseStatusTag({ status }: { status: GuesthouseRequestStatus }) {
  const label = GUESTHOUSE_STATUS_LABELS[status] ?? "—";
  switch (status) {
    case GuesthouseRequestStatus.Priced:
      return <Tag color="orange">{label}</Tag>;
    case GuesthouseRequestStatus.Paid:
      return <Tag color="green">{label}</Tag>;
    case GuesthouseRequestStatus.Rejected:
      return <Tag color="red">{label}</Tag>;
    default:
      return <Tag>{label}</Tag>;
  }
}

// ── استخر ────────────────────────────────────────────────────────────────────

function PoolReservations() {
  const { message } = App.useApp();
  const [payingId, setPayingId] = useState<number | null>(null);

  const reservations = useApiQuery(queryKeys.reservations.mine(), walfareApi.myReservations);

  /** Retry payment for a reservation abandoned at the gateway. */
  const payAgain = async (r: Reservation) => {
    setPayingId(r.id);
    try {
      const init = await walfareApi.initPayment(r.id);
      window.location.href = init.redirectUrl;
    } catch (err) {
      message.error(errorMessage(err, "اتصال به درگاه ناموفق بود"));
      setPayingId(null);
    }
  };

  // Only take over when there is NOTHING to show: React Query keeps `data` and sets `error`
  // when a background refetch fails, so gating on `error` alone blanks a good list.
  if (reservations.error && !reservations.data) {
    return <Alert type="error" showIcon message={errorMessage(reservations.error)} />;
  }
  if (reservations.isLoading) return <Skeleton active paragraph={{ rows: 5 }} />;
  if (!reservations.data || reservations.data.length === 0) {
    return <EmptyState description="هنوز رزروی ثبت نکرده‌اید." />;
  }

  return (
    <List
      grid={{ gutter: 16, xs: 1, md: 2, xl: 3 }}
      dataSource={reservations.data}
      renderItem={(r) => (
        <List.Item>
          <Card>
            <Space direction="vertical" size={6} style={{ width: "100%" }}>
              {/* A long pool name plus its status must wrap, not overflow the card. */}
              <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
                <Typography.Text strong style={{ overflowWrap: "anywhere" }}>
                  {r.poolName}
                </Typography.Text>
                <StatusTag status={r.status} />
              </Space>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                تاریخ: {faDigits(r.date)} — مبلغ: {faMoney(r.amountRials)}
              </Typography.Text>
              {r.trackingCode ? (
                <Typography.Text copyable={{ text: r.trackingCode }} style={{ fontSize: 13 }}>
                  <NumberOutlined /> کد رهگیری: {faDigits(r.trackingCode)}
                </Typography.Text>
              ) : null}
              {r.status === ReservationStatus.PendingPayment ? (
                <Button
                  type="primary"
                  icon={<CreditCardOutlined />}
                  loading={payingId === r.id}
                  onClick={() => payAgain(r)}
                  block
                >
                  پرداخت
                </Button>
              ) : null}
            </Space>
          </Card>
        </List.Item>
      )}
    />
  );
}

// ── مهمانسرا ─────────────────────────────────────────────────────────────────

function GuesthouseRequestCard({ request }: { request: GuesthouseRequest }) {
  const navigate = useNavigate();

  // BOTH conditions, not either. `Priced` is what makes an amount real, and the token is what
  // the payment page resolves — reject clears the token, so this can never open a dead link.
  const canPay =
    request.status === GuesthouseRequestStatus.Priced && request.paymentToken !== null;

  return (
    <Card>
      <Space direction="vertical" size={6} style={{ width: "100%" }}>
        <Space wrap style={{ width: "100%", justifyContent: "space-between" }}>
          <Typography.Text strong style={{ overflowWrap: "anywhere" }}>
            {request.guesthouseName}
            {request.guesthouseCity ? ` — ${request.guesthouseCity}` : ""}
          </Typography.Text>
          <GuesthouseStatusTag status={request.status} />
        </Space>

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          از {faDigits(request.checkInDateJalali)} تا {faDigits(request.checkOutDateJalali)}
        </Typography.Text>

        <Space wrap size={6}>
          <Tag>{faDigits(request.nights)} شب</Tag>
          <Tag>{faDigits(request.guestCount)} نفر</Tag>
        </Space>

        {/* On a refusal this is the office's reason, and the member is owed it. On a priced
            request it is an optional note. The label says which, so neither is mistaken. */}
        {request.adminNote ? (
          <Typography.Text
            type={request.status === GuesthouseRequestStatus.Rejected ? "danger" : "secondary"}
            style={{ fontSize: 12, overflowWrap: "anywhere" }}
          >
            {request.status === GuesthouseRequestStatus.Rejected ? "دلیل رد: " : "توضیح: "}
            {request.adminNote}
          </Typography.Text>
        ) : null}

        {request.receiptNumber ? (
          <Typography.Text copyable={{ text: request.receiptNumber }} style={{ fontSize: 13 }}>
            <NumberOutlined /> شماره فیش: {faDigits(request.receiptNumber)}
          </Typography.Text>
        ) : null}

        {canPay ? (
          <>
            <Typography.Text strong>{faToman(request.amountRials)}</Typography.Text>
            <Button
              type="primary"
              icon={<CreditCardOutlined />}
              onClick={() => navigate(`/pay/guesthouse/${request.paymentToken}`)}
              block
            >
              پرداخت
            </Button>
          </>
        ) : request.status === GuesthouseRequestStatus.Priced ? (
          // Priced, but no link to open. Rare — pricing always mints a token — yet without this
          // the card would say «منتظر پرداخت» and offer no way to pay and no reason why.
          <Typography.Text type="warning" style={{ fontSize: 12 }}>
            لینک پرداخت در دسترس نیست. لطفاً با امور رفاهی تماس بگیرید.
          </Typography.Text>
        ) : null}
      </Space>
    </Card>
  );
}

function GuesthouseRequests() {
  const requests = useApiQuery(
    queryKeys.guesthouseRequests.mine(),
    walfareApi.myGuesthouseRequests,
  );

  if (requests.error && !requests.data) {
    return <Alert type="error" showIcon message={errorMessage(requests.error)} />;
  }
  if (requests.isLoading) return <Skeleton active paragraph={{ rows: 5 }} />;
  if (!requests.data || requests.data.length === 0) {
    return <EmptyState description="هنوز درخواست مهمانسرایی ثبت نکرده‌اید." />;
  }

  return (
    <List
      grid={{ gutter: 16, xs: 1, md: 2, xl: 3 }}
      dataSource={requests.data}
      renderItem={(r) => (
        <List.Item>
          <GuesthouseRequestCard request={r} />
        </List.Item>
      )}
    />
  );
}

export function MyReservationsPage() {
  return (
    <>
      <PageHeader title="رزروهای من" subtitle="تاریخچه رزروها، وضعیت پرداخت و کد رهگیری" />
      <Tabs
        defaultActiveKey="pools"
        items={[
          { key: "pools", label: "استخر", children: <PoolReservations /> },
          { key: "guesthouse", label: "مهمانسرا", children: <GuesthouseRequests /> },
        ]}
      />
    </>
  );
}
