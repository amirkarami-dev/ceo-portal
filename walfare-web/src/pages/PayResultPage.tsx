import { Button, Result, Space, Typography } from "antd";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "@/query";
import { faDigits } from "@/lib/jalali";

/**
 * Landing page for the bank's 302 after payment (`?status=ok|failed|notfound&tracking=…`).
 * The status here is DISPLAY-only — the truth was already written by the API's verified callback.
 */
export function PayResultPage() {
  const [params] = useSearchParams();
  const qc = useQueryClient();

  const status = params.get("status") ?? "failed";
  const tracking = params.get("tracking");

  // The reservation status changed server-side while we were at the gateway.
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: queryKeys.reservations.all() });
    void qc.invalidateQueries({ queryKey: queryKeys.pools.all() });
  }, [qc]);

  if (status === "ok") {
    return (
      <Result
        status="success"
        title="پرداخت با موفقیت انجام شد"
        subTitle={
          tracking ? (
            <Space direction="vertical">
              <Typography.Text>
                کد رهگیری شما: <Typography.Text strong copyable={{ text: tracking }}>{faDigits(tracking)}</Typography.Text>
              </Typography.Text>
              <Typography.Text type="secondary">این کد در «رزروهای من» نیز ذخیره شده است.</Typography.Text>
            </Space>
          ) : undefined
        }
        extra={
          <Link to="/reservations">
            <Button type="primary">مشاهده رزروهای من</Button>
          </Link>
        }
      />
    );
  }

  return (
    <Result
      status="error"
      title="پرداخت انجام نشد"
      subTitle="مبلغی از حساب شما کسر نشده است؛ در صورت کسر، طی ۷۲ ساعت باز می‌گردد. می‌توانید از «رزروهای من» دوباره تلاش کنید."
      extra={
        <Space>
          <Link to="/reservations">
            <Button type="primary">رزروهای من</Button>
          </Link>
          <Link to="/">
            <Button>خدمات رفاهی</Button>
          </Link>
        </Space>
      }
    />
  );
}
