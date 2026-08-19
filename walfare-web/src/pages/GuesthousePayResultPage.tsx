import { Button, Card, Result, Space, Typography } from "antd";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "@/auth/useAuth";
import { faDigits } from "@/lib/jalali";

/**
 * Where the bank lands a guesthouse payer, ANONYMOUS on purpose.
 *
 * `/pay/result` cannot serve this: it sits inside RequireAuth, so a payer with no account —
 * the case this whole feature exists for — would be redirected to a login they can never pass,
 * immediately after paying real money, and would never learn whether it worked.
 *
 * Like PayResultPage, the status here is DISPLAY-only. The truth was already written by the
 * API's server-to-server verify before this page ever loaded.
 */
export function GuesthousePayResultPage() {
  const [params] = useSearchParams();
  const { user } = useAuth();

  const status = params.get("status") ?? "failed";
  const tracking = params.get("tracking");

  const content =
    status === "ok" ? (
      <Result
        status="success"
        title="پرداخت با موفقیت انجام شد"
        subTitle={
          <Space direction="vertical" size={8}>
            {tracking ? (
              <Typography.Text>
                کد رهگیری شما:{" "}
                <Typography.Text strong copyable={{ text: tracking }}>
                  {faDigits(tracking)}
                </Typography.Text>
              </Typography.Text>
            ) : null}
            <Typography.Text type="secondary">
              این کد را نگه دارید. معرفی‌نامه توسط امور رفاهی صادر می‌شود.
            </Typography.Text>
          </Space>
        }
        // Only for somebody who is actually signed in. Showing this to the anonymous payer
        // would send them to a login screen — the very trap this page exists to avoid.
        extra={
          user ? (
            <Link to="/reservations">
              <Button type="primary">مشاهده درخواست‌های من</Button>
            </Link>
          ) : undefined
        }
      />
    ) : (
      <Result
        status="error"
        title="پرداخت انجام نشد"
        subTitle="مبلغی از حساب شما کسر نشده است؛ در صورت کسر، طی ۷۲ ساعت باز می‌گردد. می‌توانید از همان لینک پرداخت دوباره تلاش کنید."
      />
    );

  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 520 }}>{content}</Card>
    </div>
  );
}
