import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Progress,
  Row,
  Skeleton,
  Space,
  Statistic,
  Tag,
  Typography,
  theme,
} from "antd";
import { ArrowRightOutlined, TrophyFilled } from "@ant-design/icons";
import { PageHeader } from "../../components/PageHeader";
import { useElectionResult } from "../../lib/queries";
import { RESHTE_OPTIONS, type CandidateResult } from "../../lib/types";
import { ApiError } from "../../lib/api";

const fa = (n: number) => n.toLocaleString("fa-IR");
const RESHTE_LABEL = new Map(RESHTE_OPTIONS.map((r) => [r.value, r.label] as [string, string]));

function initials(name: string): string {
  return name.trim().charAt(0) || "؟";
}

export function ElectionResults() {
  const { id: idParam } = useParams();
  const id = idParam ? Number(idParam) : undefined;
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  const { data, isLoading, error } = useElectionResult(id);

  // This page serves both audiences — /admin/:id/result and the voter's /result/:id — so "back" has to
  // follow the route it was reached through. Sending a voter to /admin would bounce them off 403.
  const backTo = location.pathname.startsWith("/admin") ? "/admin" : "/";

  const back = (
    <Button icon={<ArrowRightOutlined />} onClick={() => navigate(backTo)}>
      بازگشت
    </Button>
  );

  if (isLoading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 6 }} />
      </Card>
    );
  }

  if (error || !data) {
    // A 404 here is the normal "not counted yet" case, not a broken page — the API returns NotFound
    // before the tally on purpose, so that a pending result leaks nothing.
    const notYet = error instanceof ApiError && error.status === 404;
    return (
      <>
        <PageHeader title="نتیجه انتخابات" extra={back} />
        <Card>
          <Empty
            description={
              notYet
                ? // Same 404, different reader: an admin needs to know what to do about it, a voter
                  // needs to know nothing is wrong.
                  backTo === "/admin"
                  ? "نتیجهٔ این انتخابات هنوز اعلام نشده است. پس از پایان رأی‌گیری، از فهرست انتخابات گزینهٔ «شمارش آرا» را بزنید."
                  : "نتیجهٔ این انتخابات هنوز اعلام نشده است. پس از پایان رأی‌گیری و شمارش آرا، نتیجه در همین صفحه نمایش داده می‌شود."
                : error instanceof ApiError
                  ? error.message
                  : "نتیجه در دسترس نیست"
            }
          />
        </Card>
      </>
    );
  }

  const top = data.candidates[0]?.votes ?? 0;
  // The winner(s) — plural, because a tie at the top must not be quietly presented as one winner.
  const winners = data.candidates.filter((c) => c.rank === 1);
  const tiedAtTop = winners.length > 1;

  return (
    <>
      <PageHeader
        title={`نتیجه: ${data.title}`}
        subtitle={`${data.dateJalali} — ${data.eligibilitySummary}`}
        extra={back}
      />

      {tiedAtTop && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="نتیجه مساوی است"
          description={`${fa(winners.length)} کاندیدا با ${fa(top)} رأی در رتبهٔ اول قرار دارند. تصمیم‌گیری دربارهٔ نتیجهٔ مساوی خارج از سامانه انجام می‌شود.`}
        />
      )}

      {data.ballotsPurged && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="برگه‌های رأی پاک شده‌اند"
          description="۳۰ روز پس از انتخابات، برگه‌های رأی پاک می‌شوند. اعداد زیر همان نتیجهٔ ثبت‌شده در زمان شمارش است و دیگر قابل شمارش مجدد نیست."
        />
      )}

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="تعداد رأی‌دهندگان" value={fa(data.ballotsCast)} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="مجموع انتخاب‌ها" value={fa(data.votesCast)} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="انتخاب مجاز هر نفر" value={fa(data.maxSelections)} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic title="تعداد کاندیداها" value={fa(data.candidates.length)} />
          </Card>
        </Col>
      </Row>

      <Card
        title="آرای کاندیداها"
        extra={
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            رتبه‌های مساوی، رتبهٔ مشترک می‌گیرند
          </Typography.Text>
        }
      >
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {data.candidates.map((c: CandidateResult) => {
            const share = top > 0 ? Math.round((c.votes / top) * 100) : 0;
            const isWinner = c.rank === 1 && c.votes > 0;

            return (
              <div key={c.candidateId}>
                <Row align="middle" gutter={12} style={{ marginBottom: 6 }}>
                  <Col flex="none">
                    <Avatar
                      size={44}
                      src={c.image ?? undefined}
                      style={{ background: isWinner ? token.colorPrimary : token.colorFillSecondary }}
                    >
                      {initials(c.fullName)}
                    </Avatar>
                  </Col>
                  <Col flex="auto">
                    <Space size={6} wrap>
                      <Typography.Text strong>{c.fullName}</Typography.Text>
                      {isWinner && (
                        <Tag color="gold" icon={<TrophyFilled />}>
                          {tiedAtTop ? "رتبهٔ اول (مساوی)" : "نفر اول"}
                        </Tag>
                      )}
                      {!isWinner && c.isTie && <Tag>رتبهٔ مشترک {fa(c.rank)}</Tag>}
                    </Space>
                    <div>
                      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        {[
                          c.reshteCode ? (RESHTE_LABEL.get(c.reshteCode) ?? `رشتهٔ ${c.reshteCode}`) : null,
                          c.educationLevel,
                        ]
                          .filter(Boolean)
                          .join(" — ") || "—"}
                      </Typography.Text>
                    </div>
                  </Col>
                  <Col flex="none">
                    <Space size={4}>
                      <Typography.Text strong style={{ fontSize: 16 }}>
                        {fa(c.votes)}
                      </Typography.Text>
                      <Typography.Text type="secondary">رأی</Typography.Text>
                    </Space>
                  </Col>
                </Row>
                {/* Bars are relative to the leader, not to turnout: with maxSelections > 1 a share of
                    total votes would be meaningless. */}
                <Progress
                  percent={share}
                  showInfo={false}
                  strokeColor={isWinner ? token.colorPrimary : token.colorFillSecondary}
                />
              </div>
            );
          })}
        </Space>
      </Card>

      <Card size="small" style={{ marginTop: 16 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {/* The digest is what ties these numbers to the ballots that produced them. It stays valid
              after the purge, which is the only reason a purged result is still trustworthy. */}
          اثر انگشت نتیجه (SHA-256 برگه‌های رأی در زمان شمارش):
        </Typography.Text>
        <Typography.Paragraph
          copyable
          dir="ltr"
          style={{ marginBottom: 0, fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}
        >
          {data.resultDigest || "—"}
        </Typography.Paragraph>
      </Card>

      <Typography.Paragraph type="secondary" style={{ fontSize: 12, marginTop: 12 }}>
        تفکیک مشارکت بر اساس رشته وجود ندارد. فهرست رأی‌دهندگان فقط شامل یک اثر انگشت رمزنگاری‌شده است و
        رشته، ساعت یا روش رأی دادن در آن ذخیره نمی‌شود — این بخشی از محرمانه بودن رأی است.
      </Typography.Paragraph>
    </>
  );
}
