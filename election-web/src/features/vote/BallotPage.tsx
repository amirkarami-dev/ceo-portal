import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Col,
  Divider,
  Modal,
  Result,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import { ArrowRightOutlined, CheckOutlined, WarningFilled } from "@ant-design/icons";
import { PageHeader } from "../../components/PageHeader";
import { CandidateCard } from "./CandidateCard";
import { Countdown } from "./Countdown";
import { useCastVote, useMyBallots } from "../../lib/queries";
import { ElectionPhase, PHASE_LABELS, fromWireTime } from "../../lib/types";
import { ApiError } from "../../lib/api";

const fa = (n: number) => n.toLocaleString("fa-IR");

export function BallotPage() {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const navigate = useNavigate();

  const { data, isLoading, error, refetch } = useMyBallots();
  const cast = useCastVote();

  /**
   * The chosen candidate ids.
   *
   * In memory only, and deliberately never in the URL, in `localStorage`, or in a query string — a
   * vote in the address bar lands in browser history, in the `Referer` header of the next request, and
   * in any proxy log along the way. The whole point of sealing the ballot server-side is undone if the
   * choice travels in a URL.
   */
  const [chosen, setChosen] = useState<number[]>([]);
  const [confirming, setConfirming] = useState(false);
  /** Set once the server accepts. Takes precedence over the refreshed ballot, which now says
   *  "you have already voted" — correct, but not what someone who just voted should read. */
  const [done, setDone] = useState<string | null>(null);

  const ballot = useMemo(() => data?.find((b) => b.id === id), [data, id]);

  const back = (
    <Button icon={<ArrowRightOutlined />} onClick={() => navigate("/")}>
      بازگشت
    </Button>
  );

  if (isLoading) {
    return (
      <Card>
        <Skeleton active paragraph={{ rows: 8 }} />
      </Card>
    );
  }

  if (done) {
    return (
      <Card>
        <Result
          status="success"
          title={done}
          subTitle="رأی شما به صورت رمزنگاری‌شده ثبت شد. سامانه نمی‌تواند رأی شما را به نام شما بازگرداند و رأی ثبت‌شده قابل تغییر نیست."
          extra={
            <Button type="primary" onClick={() => navigate("/")}>
              بازگشت به فهرست انتخابات
            </Button>
          }
        />
      </Card>
    );
  }

  if (error || !ballot) {
    return (
      <>
        <PageHeader title="برگهٔ رأی" extra={back} />
        <Alert
          type="warning"
          showIcon
          message="این برگهٔ رأی در دسترس نیست"
          description={
            error instanceof ApiError
              ? error.message
              : "این انتخابات منتشر نشده است، یا برای شما قابل مشاهده نیست."
          }
        />
      </>
    );
  }

  // The server's verdict, never re-derived here. If it says no, the ballot is not shown at all —
  // letting someone choose and only then refusing them is worse than not offering.
  if (!ballot.canVote) {
    return (
      <>
        <PageHeader title={ballot.title} subtitle={ballot.eligibilitySummary} extra={back} />
        <Alert
          type={ballot.alreadyVoted ? "success" : "warning"}
          showIcon
          message={
            ballot.alreadyVoted ? "رأی شما قبلاً ثبت شده است" : "امکان رأی دادن وجود ندارد"
          }
          description={ballot.reason || PHASE_LABELS[ballot.phase]}
        />
        {ballot.phase === ElectionPhase.ResultsAvailable && (
          <Button style={{ marginTop: 16 }} onClick={() => navigate(`/result/${ballot.id}`)}>
            مشاهده نتیجه
          </Button>
        )}
      </>
    );
  }

  const max = ballot.maxSelections;
  const single = max === 1;
  const atCap = chosen.length >= max;

  const toggle = (candidateId: number) => {
    setChosen((current) => {
      if (current.includes(candidateId)) {
        return current.filter((c) => c !== candidateId);
      }
      // Single-choice: picking another candidate REPLACES the choice. Disabling every other card
      // after the first pick would force a deselect-then-select dance for the commonest election
      // shape. The design's "disable at the cap" rule is for the multi-select case, where a silently
      // ignored click is the real hazard.
      if (single) return [candidateId];
      if (current.length >= max) return current;
      return [...current, candidateId];
    });
  };

  const chosenNames = ballot.candidates
    .filter((c) => chosen.includes(c.id))
    .map((c) => c.fullName);

  const submit = () => {
    cast.mutate(
      { electionId: ballot.id, candidateIds: chosen },
      {
        onSuccess: (r) => {
          setConfirming(false);
          setDone(r.message || "رأی شما ثبت شد");
        },
        onError: () => {
          // Keep the modal open with the server's reason visible — closing it would look like the
          // vote went through.
        },
      },
    );
  };

  return (
    <>
      <PageHeader
        title={ballot.title}
        subtitle={`${ballot.eligibilitySummary} — ${ballot.dateJalali}، ${fromWireTime(ballot.startTime)} تا ${fromWireTime(ballot.endTime)}`}
        extra={back}
      />

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={
          single
            ? "یک کاندیدا را انتخاب کنید"
            : `حداکثر ${fa(max)} کاندیدا می‌توانید انتخاب کنید`
        }
        description={
          <Space direction="vertical" size={2}>
            <span>
              رأی شما محرمانه است و پس از ثبت، قابل تغییر یا حذف نیست. هر عضو فقط یک بار می‌تواند رأی
              دهد.
            </span>
            <Countdown
              to={ballot.closesAtUtc}
              prefix="زمان باقی‌مانده تا پایان رأی‌گیری:"
              onElapsed={() => void refetch()}
            />
          </Space>
        }
      />

      {ballot.description && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Typography.Paragraph style={{ marginBottom: 0, whiteSpace: "pre-wrap" }}>
            {ballot.description}
          </Typography.Paragraph>
        </Card>
      )}

      <Row gutter={[16, 16]}>
        {/* Order is exactly as the server sent it — the API returns candidates by SortOrder and this
            never sorts, filters or shuffles. A changing order would change what voters see and could
            be argued to favour someone. */}
        {ballot.candidates.map((c) => (
          <Col key={c.id} xs={24} sm={12} lg={8}>
            <CandidateCard
              candidate={c}
              selected={chosen.includes(c.id)}
              disabled={!single && atCap && !chosen.includes(c.id)}
              disabledReason={`حداکثر ${fa(max)} نفر`}
              onToggle={() => toggle(c.id)}
            />
          </Col>
        ))}
      </Row>

      {/* Sticky so the count and the button stay reachable on a long ballot on a phone. */}
      <div
        style={{
          position: "sticky",
          bottom: 0,
          marginTop: 20,
          paddingBlock: 12,
          background: "var(--vote-bar-bg, transparent)",
        }}
      >
        <Card size="small">
          <Row align="middle" gutter={[12, 12]}>
            <Col flex="auto">
              <Space wrap size={6}>
                <Typography.Text strong>
                  {chosen.length === 0
                    ? "هنوز کاندیدایی انتخاب نکرده‌اید"
                    : `${fa(chosen.length)} از ${fa(max)} انتخاب شد`}
                </Typography.Text>
                {chosenNames.map((n) => (
                  <Tag key={n} color="blue">
                    {n}
                  </Tag>
                ))}
              </Space>
            </Col>
            <Col flex="none">
              <Button
                type="primary"
                size="large"
                icon={<CheckOutlined />}
                disabled={chosen.length === 0}
                onClick={() => setConfirming(true)}
              >
                ثبت رأی
              </Button>
            </Col>
          </Row>
        </Card>
      </div>

      <Modal
        open={confirming}
        title="تأیید نهایی رأی"
        okText="بله، رأی من را ثبت کن"
        cancelText="بازگشت و تغییر"
        confirmLoading={cast.isPending}
        // No dismiss-by-backdrop while the request is in flight: a stray click would leave the voter
        // unsure whether it went through.
        maskClosable={!cast.isPending}
        closable={!cast.isPending}
        cancelButtonProps={{ disabled: cast.isPending }}
        onCancel={() => setConfirming(false)}
        onOk={submit}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Typography.Text>
            رأی شما به {single ? "کاندیدای" : "کاندیداهای"} زیر ثبت می‌شود:
          </Typography.Text>
          <ul style={{ margin: 0, paddingInlineStart: 20 }}>
            {chosenNames.map((n) => (
              <li key={n}>
                <Typography.Text strong>{n}</Typography.Text>
              </li>
            ))}
          </ul>
          <Divider style={{ margin: 0 }} />
          <Typography.Text type="danger">
            <WarningFilled style={{ marginInlineEnd: 6 }} />
            پس از ثبت، رأی قابل تغییر یا حذف نیست.
          </Typography.Text>

          {cast.isError && (
            <Alert
              type="error"
              showIcon
              message={
                cast.error instanceof ApiError ? cast.error.message : "ثبت رأی انجام نشد"
              }
            />
          )}
        </Space>
      </Modal>
    </>
  );
}
