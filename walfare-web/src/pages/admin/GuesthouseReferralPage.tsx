import { Button, Card, Descriptions, Result, Skeleton, Space, Typography } from "antd";
import { ArrowLeftOutlined, PrinterOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router-dom";
import { COMPANION_RELATION_LABELS, walfareApi } from "@/api/walfareApi";
import { errorMessage } from "@/api/client";
import { queryKeys, useApiQuery } from "@/query";
import { faDigits } from "@/lib/jalali";

/**
 * «مسئول محترم مهمانسرای {X}» — without doubling the word.
 *
 * The paper form's blank follows «مهمانسرای», but names are stored the way people say them and
 * almost always start with the same word, so the plain template prints «مسئول محترم مهمانسرای
 * مهمانسرای شماره یک» on every single letter. When the name already opens with it, the prefix
 * is dropped instead of repeated.
 */
function salutation(guesthouseName: string): string {
  const name = guesthouseName.trim();
  // A plain prefix test, deliberately: it covers «مهمانسرای …», «مهمانسرا …» and every other
  // ending without a character class over combining marks, which is both hard to read and easy
  // to get wrong — an earlier attempt here used one and was simply incorrect.
  return name.startsWith("مهمانسرا")
    ? `مسئول محترم ${name}`
    : `مسئول محترم مهمانسرای ${name}`;
}

/**
 * معرفی‌نامه — the bottom half of the paper form, print-ready.
 *
 * The API refuses to build one until the request is paid AND «جناب آقای / سرکار خانم» is set.
 * Both refusals arrive as a Persian sentence, and this page shows that sentence rather than an
 * empty letter: a letter addressed with the wrong honorific is worse than one not yet printed.
 */
export function GuesthouseReferralPage() {
  const { id: idParam } = useParams<{ id: string }>();
  const id = Number(idParam);
  const navigate = useNavigate();

  const referral = useApiQuery(
    queryKeys.guesthouseRequests.referral(id),
    () => walfareApi.guesthouseReferral(id),
    { enabled: Number.isFinite(id) },
  );

  const back = (
    <Button
      className="no-print"
      icon={<ArrowLeftOutlined style={{ transform: "rotate(180deg)" }} />}
      onClick={() => navigate("/admin/guesthouse-requests")}
    >
      بازگشت به فهرست درخواست‌ها
    </Button>
  );

  if (!Number.isFinite(id)) {
    return <Result status="error" title="درخواست نامعتبر" extra={back} />;
  }

  // Data before error, the rule this feature keeps re-learning: React Query holds `data` and
  // sets `error` when a background refetch fails, and a printable letter must not vanish from
  // under the admin because the network blinked while they reached for the printer.
  const r = referral.data;
  if (!r) {
    if (referral.isLoading) return <Skeleton active paragraph={{ rows: 8 }} />;
    return (
      <Result
        status="warning"
        title="معرفی‌نامه هنوز قابل صدور نیست"
        subTitle={errorMessage(referral.error)}
        extra={back}
      />
    );
  }

  const companions = r.companions ?? [];

  return (
    <>
      <Space className="no-print" style={{ marginBottom: 16 }} wrap>
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          چاپ
        </Button>
        {back}
      </Space>

      {/* Everything inside print-area is what lands on paper. */}
      <Card className="print-area">
        <Typography.Paragraph strong style={{ fontSize: 16, marginBottom: 4 }}>
          {salutation(r.guesthouseName)}
        </Typography.Paragraph>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 24 }}>
          {r.guesthouseCity}
          {r.managerName ? ` — مسئول: ${r.managerName}` : ""}
        </Typography.Paragraph>

        <Descriptions
          bordered
          column={1}
          size="small"
          style={{ marginBottom: 24 }}
          items={[
            { key: "name", label: "نام و نام خانوادگی", children: r.fullName },
            {
              key: "stay",
              label: "تاریخ اقامت",
              children: `${faDigits(r.checkInDateJalali)} تا ${faDigits(r.checkOutDateJalali)}`,
            },
            { key: "nights", label: "مدت اقامت", children: `${faDigits(r.nights)} شب` },
            { key: "guests", label: "تعداد نفرات", children: `${faDigits(r.guestCount)} نفر` },
            {
              key: "receipt",
              label: "شماره فیش",
              children: r.receiptNumber ? faDigits(r.receiptNumber) : "—",
            },
            ...(companions.length > 0
              ? [
                  {
                    key: "companions",
                    label: "همراهان",
                    children: (
                      <Space direction="vertical" size={2}>
                        {companions.map((c, i) => (
                          <Typography.Text key={`${c.fullName}-${i}`}>
                            {c.fullName}
                            {c.isInfant
                              ? " (کودک زیر دو سال)"
                              : c.relation !== null
                                ? ` — ${COMPANION_RELATION_LABELS[c.relation]}`
                                : ""}
                          </Typography.Text>
                        ))}
                      </Space>
                    ),
                  },
                ]
              : []),
          ]}
        />

        <Typography.Paragraph style={{ fontSize: 15, lineHeight: 2, textAlign: "justify" }}>
          احتراماً {r.applicantTitle} <strong>{r.fullName}</strong> با مشخصات فوق با شماره فیش{" "}
          <strong>{r.receiptNumber ? faDigits(r.receiptNumber) : "—"}</strong> جهت هماهنگی‌های لازم
          بحضور معرفی می‌گردد.
        </Typography.Paragraph>

        {/* Blank room for the stamp and the signature — the office signs this by hand. */}
        <div style={{ marginTop: 48, textAlign: "left" }}>
          <Typography.Text strong>امور رفاهی</Typography.Text>
          <div style={{ height: 96 }} />
        </div>
      </Card>
    </>
  );
}
