import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  FormOutlined,
  TrophyOutlined,
} from "@ant-design/icons";
import { PageHeader } from "../../components/PageHeader";
import { Countdown } from "./Countdown";
import { useMyBallots } from "../../lib/queries";
import {
  ElectionPhase,
  PHASE_COLOURS,
  PHASE_LABELS,
  fromWireTime,
  type Ballot,
} from "../../lib/types";
import { ApiError } from "../../lib/api";

const fa = (n: number) => n.toLocaleString("fa-IR");

export function MyBallots() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useMyBallots();

  if (isLoading) {
    return (
      <>
        <PageHeader title="رأی‌گیری" />
        <Card>
          <Skeleton active paragraph={{ rows: 6 }} />
        </Card>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="رأی‌گیری" />
        <Alert
          type="error"
          showIcon
          message="فهرست انتخابات در دسترس نیست"
          description={error instanceof ApiError ? error.message : "خطای غیرمنتظره"}
          action={
            <Button size="small" onClick={() => void refetch()}>
              تلاش دوباره
            </Button>
          }
        />
      </>
    );
  }

  const ballots = data ?? [];

  return (
    <>
      <PageHeader
        title="رأی‌گیری"
        subtitle="انتخابات‌هایی که برای شما منتشر شده است"
      />

      {ballots.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="در حال حاضر انتخاباتی برای شما منتشر نشده است"
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {ballots.map((b) => (
            <Col key={b.id} xs={24} lg={12}>
              <BallotSummary ballot={b} onElapsed={() => void refetch()} onOpen={navigate} />
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}

function BallotSummary({
  ballot: b,
  onElapsed,
  onOpen,
}: {
  ballot: Ballot;
  onElapsed: () => void;
  onOpen: (to: string) => void;
}) {
  const resultsOut = b.phase === ElectionPhase.ResultsAvailable;

  return (
    <Card
      style={{ height: "100%" }}
      title={
        <Space direction="vertical" size={2} style={{ paddingBlock: 8 }}>
          <Typography.Text strong style={{ whiteSpace: "normal" }}>
            {b.title}
          </Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>
            {b.eligibilitySummary}
          </Typography.Text>
        </Space>
      }
      extra={<Tag color={PHASE_COLOURS[b.phase]}>{PHASE_LABELS[b.phase]}</Tag>}
    >
      <Space direction="vertical" size={10} style={{ width: "100%" }}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          <ClockCircleOutlined style={{ marginInlineEnd: 6 }} />
          {b.dateJalali} — {fromWireTime(b.startTime)} تا {fromWireTime(b.endTime)}
        </Typography.Text>

        {b.description && (
          <Typography.Paragraph style={{ marginBottom: 0, fontSize: 13 }} ellipsis={{ rows: 2 }}>
            {b.description}
          </Typography.Paragraph>
        )}

        <Typography.Text style={{ fontSize: 13 }}>
          {b.maxSelections > 1
            ? `از میان ${fa(b.candidates.length)} کاندیدا، حداکثر ${fa(b.maxSelections)} نفر`
            : `${fa(b.candidates.length)} کاندیدا، یک انتخاب`}
        </Typography.Text>

        {/* The order below matters. `alreadyVoted` is checked first so a voter who has cast their
            ballot is told so plainly, even once the window has closed — the generic "voting has
            ended" message would leave them wondering whether their vote registered. */}
        {b.alreadyVoted ? (
          <Alert
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
            message="رأی شما ثبت شده است"
            description="هر عضو فقط یک بار می‌تواند رأی دهد و رأی ثبت‌شده قابل تغییر نیست."
          />
        ) : b.phase === ElectionPhase.NotYetOpen ? (
          <Alert
            type="info"
            showIcon
            message="رأی‌گیری هنوز آغاز نشده است"
            description={
              <Countdown to={b.opensAtUtc} prefix="زمان باقی‌مانده تا شروع:" onElapsed={onElapsed} />
            }
          />
        ) : b.canVote ? (
          <Countdown to={b.closesAtUtc} prefix="زمان باقی‌مانده تا پایان:" onElapsed={onElapsed} />
        ) : (
          // The server's own words. It knows which of the six conditions failed; guessing here would
          // eventually contradict it.
          <Alert type="warning" showIcon message={b.reason || "امکان رأی دادن وجود ندارد"} />
        )}

        <Space wrap>
          {b.canVote && (
            <Button type="primary" icon={<FormOutlined />} onClick={() => onOpen(`/vote/${b.id}`)}>
              ورود به برگهٔ رأی
            </Button>
          )}
          {resultsOut && (
            <Button icon={<TrophyOutlined />} onClick={() => onOpen(`/result/${b.id}`)}>
              مشاهده نتیجه
            </Button>
          )}
        </Space>
      </Space>
    </Card>
  );
}
