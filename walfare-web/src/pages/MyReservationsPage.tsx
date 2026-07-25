import { Alert, App, Button, Card, List, Skeleton, Space, Tag, Typography } from "antd";
import { CreditCardOutlined, NumberOutlined } from "@ant-design/icons";
import { useState } from "react";
import { walfareApi, ReservationStatus, type Reservation } from "@/api/walfareApi";
import { errorMessage } from "@/api/client";
import { queryKeys, useApiQuery } from "@/query";
import { EmptyState, PageHeader } from "@/components/ui";
import { faDigits, faMoney } from "@/lib/jalali";

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

export function MyReservationsPage() {
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

  return (
    <>
      <PageHeader title="رزروهای من" subtitle="تاریخچه رزروها، وضعیت پرداخت و کد رهگیری" />

      {reservations.error ? (
        <Alert type="error" showIcon message={errorMessage(reservations.error)} />
      ) : reservations.isLoading ? (
        <Skeleton active paragraph={{ rows: 5 }} />
      ) : reservations.data && reservations.data.length > 0 ? (
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
      ) : (
        <EmptyState description="هنوز رزروی ثبت نکرده‌اید." />
      )}
    </>
  );
}
