import { useState } from "react";
import { App, Button, Card, Result, Skeleton, Space, Tag, Typography } from "antd";
import { CreditCardOutlined } from "@ant-design/icons";
import { useParams } from "react-router-dom";
import { walfareApi } from "@/api/walfareApi";
import { ApiError, errorMessage } from "@/api/client";
import { queryKeys, useApiQuery } from "@/query";
import { faDigits, faToman } from "@/lib/jalali";

/**
 * The page the SMS link opens. ANONYMOUS on purpose — whoever opens it may have no account at
 * all, which is the entire point of the feature. Its route must stay OUTSIDE RequireAuth.
 *
 * It shows the stay and the amount and nothing else. No name, no کد ملی, no membership number,
 * no companion names. The API leaves them out deliberately (a server test fails if a tenth
 * field is added), because this link travels in an SMS that anybody can forward. If a field
 * looks missing here, it was removed on purpose — do not add it back.
 */
export function GuesthousePayPage() {
  const { token = "" } = useParams<{ token: string }>();
  const { message } = App.useApp();
  const [paying, setPaying] = useState(false);

  const summary = useApiQuery(
    queryKeys.guesthouseRequests.paySummary(token),
    () => walfareApi.guesthousePaySummary(token),
    { enabled: token.length > 0 },
  );

  const pay = async () => {
    setPaying(true);
    try {
      const init = await walfareApi.initGuesthousePayment(token);
      window.location.href = init.redirectUrl;
    } catch (err) {
      // This route is rate limited to 10 attempts per 10 minutes per IP. Without this the payer
      // would read a bare "HTTP 429", which tells them nothing about what to do next.
      if (err instanceof ApiError && err.status === 429) {
        message.error("تعداد تلاش‌ها زیاد است. چند دقیقه دیگر دوباره تلاش کنید.");
      } else {
        message.error(errorMessage(err, "اتصال به درگاه پرداخت ناموفق بود"));
      }
      setPaying(false);
    }
  };

  const body = () => {
    if (!token) {
      return <Result status="error" title="این لینک پرداخت معتبر نیست." />;
    }
    // Data FIRST, error second, and the order is the whole point. React Query KEEPS `data` and
    // sets `error` when a BACKGROUND refetch fails, so asking about `error` first tells somebody
    // holding a perfectly good link that it is invalid the moment their phone blinks — and a
    // payer told that stops paying. Serving the cached summary is safe: `init` re-checks
    // payability on the server, and completion refuses an amount that no longer matches.
    const s = summary.data;
    if (!s) {
      if (summary.isLoading) return <Skeleton active paragraph={{ rows: 5 }} />;
      // 400 and 404 both mean "this token resolves to nothing payable". The API already says so
      // in Persian, so prefer its sentence and keep ours for anything else.
      const err = summary.error;
      const known = err instanceof ApiError && (err.status === 400 || err.status === 404);
      return (
        <Result
          status="error"
          title="این لینک پرداخت معتبر نیست."
          subTitle={known ? errorMessage(err) : undefined}
        />
      );
    }

    // A dead link must not keep telling a stranger about somebody's trip. The API already
    // blanks every stay field when payable is false, and this renders only the reason so a
    // future field can never leak through here either.
    if (!s.payable) {
      return (
        <Result
          status="warning"
          title="پرداخت برای این درخواست ممکن نیست"
          subTitle={s.reason || "این لینک پرداخت دیگر معتبر نیست."}
        />
      );
    }

    return (
      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <div>
          <Typography.Text strong style={{ fontSize: 16, overflowWrap: "anywhere" }}>
            {s.guesthouseName}
            {s.guesthouseCity ? ` — ${s.guesthouseCity}` : ""}
          </Typography.Text>
          <Typography.Paragraph
            type="secondary"
            style={{ fontSize: 13, marginBottom: 0, marginTop: 4 }}
          >
            از {faDigits(s.checkInDateJalali)} تا {faDigits(s.checkOutDateJalali)}
          </Typography.Paragraph>
        </div>

        <Space wrap size={6}>
          <Tag>{faDigits(s.nights)} شب</Tag>
          <Tag>{faDigits(s.guestCount)} نفر</Tag>
        </Space>

        <div>
          <Typography.Text type="secondary" style={{ fontSize: 13, display: "block" }}>
            مبلغ قابل پرداخت
          </Typography.Text>
          <Typography.Text strong style={{ fontSize: 22 }}>
            {faToman(s.amountRials)}
          </Typography.Text>
        </div>

        <Button
          type="primary"
          size="large"
          icon={<CreditCardOutlined />}
          loading={paying}
          onClick={pay}
          block
        >
          پرداخت
        </Button>

        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          پس از پرداخت موفق، معرفی‌نامه توسط امور رفاهی صادر می‌شود.
        </Typography.Text>
      </Space>
    );
  };

  // Standalone shell: no sidebar, no menu, no user chip. The visitor is not signed in and must
  // never be shown navigation that would bounce them to a login they cannot pass.
  return (
    <div style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16 }}>
      <Card style={{ width: "100%", maxWidth: 520 }} title="پرداخت هزینه مهمانسرا">
        {body()}
      </Card>
    </div>
  );
}
