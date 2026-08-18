import { Button, Card, Col, Empty, Row, Skeleton, Space, Tag, Typography, theme } from "antd";
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { PhaseChip } from "../../components/PhaseChip";
import { TimeRail } from "../../components/TimeRail";
import { useMyRooms } from "../../lib/queries";
import { describeSchedule } from "../../lib/schedule";
import { useNow } from "../../lib/useNow";
import { MOTION } from "../../theme/motion";
import { phaseColor } from "../../theme/tokens";
import { useThemeMode } from "../../theme/useThemeMode";
import { TYPE_LABELS, fa, type MyRoom } from "../../lib/types";

/** Jalali date + time of day, in Iran time, from the instant the server sent. */
const WHEN = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "Asia/Tehran",
});

function MeetingCard({ room, now, delay }: { room: MyRoom; now: number; delay: number }) {
  const { token } = theme.useToken();
  const { mode } = useThemeMode();
  const navigate = useNavigate();
  const schedule = describeSchedule(room, now);
  const startsAt = new Date(room.startsAtUtc);

  return (
    <Card
      className="room-meeting-card"
      styles={{ body: { padding: 18, paddingInlineStart: 22 } }}
      style={{
        height: "100%",
        position: "relative",
        overflow: "hidden",
        // The one that is running right now should be findable without reading anything.
        borderColor: schedule.phase === "live" ? phaseColor(mode, "live") : undefined,
      }}
    >
      <TimeRail phase={schedule.phase} fill={schedule.fill} delay={delay} />

      <Space direction="vertical" size={10} style={{ width: "100%" }}>
        <Space size={6} wrap>
          <PhaseChip phase={schedule.phase} relative={schedule.relative} />
          {/* Neutral on purpose. Colour in this card belongs to the phase and to
              nothing else, or the rail stops meaning anything. */}
          <Tag bordered={false}>{TYPE_LABELS[room.type]}</Tag>
          {room.isPresenter && (
            <Tag bordered={false} icon={<VideoCameraOutlined />}>
              شما ارائه‌دهنده‌اید
            </Tag>
          )}
        </Space>

        {/* h2 under the page's h1 — the card title is the next level down, and skipping
            one leaves a screen reader's outline with a hole in it. */}
        <Typography.Title
          level={2}
          style={{ margin: 0, fontSize: 17, fontWeight: 700, letterSpacing: "-0.2px", lineHeight: 1.5 }}
        >
          {room.name}
        </Typography.Title>

        {room.description && (
          <Typography.Paragraph type="secondary" style={{ margin: 0, fontSize: 13 }} ellipsis={{ rows: 2 }}>
            {room.description}
          </Typography.Paragraph>
        )}

        <Space size={6} style={{ color: token.colorTextSecondary, fontSize: 13 }}>
          <ClockCircleOutlined />
          <span>{WHEN.format(startsAt)}</span>
          {room.durationMinutes ? <span>— {fa(room.durationMinutes)} دقیقه</span> : null}
        </Space>

        {room.presenterName && (
          <Space size={6} style={{ color: token.colorTextSecondary, fontSize: 13 }}>
            <VideoCameraOutlined />
            <span>ارائه‌دهنده: {room.presenterName}</span>
          </Space>
        )}

        {room.liveCount > 0 && (
          <Space size={6} style={{ fontSize: 13 }}>
            <TeamOutlined />
            <span>{fa(room.liveCount)} نفر داخل جلسه</span>
          </Space>
        )}

        {/* `canJoinNow` is the SERVER's verdict, never re-derived from the browser clock. The button
            is hidden rather than disabled before then: the card already says when it starts, so a
            greyed button adds nothing but something to press at. A meeting whose time has passed can
            still show this — the server keeps the door open, and the chip above says so plainly. */}
        {room.canJoinNow && (
          <Button
            type="primary"
            block
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(`/room/${room.id}`)}
            style={{ marginTop: 4 }}
          >
            ورود به جلسه
          </Button>
        )}
      </Space>
    </Card>
  );
}

export function MyMeetings() {
  const { data, isLoading } = useMyRooms();
  const now = useNow();
  const reduced = useReducedMotion() === true;

  if (isLoading) {
    return (
      <>
        <PageHeader title="جلسات من" />
        <Row gutter={[16, 16]}>
          {[0, 1, 2].map((i) => (
            <Col key={i} xs={24} md={12} lg={8}>
              <Card>
                <Skeleton active paragraph={{ rows: 3 }} />
              </Card>
            </Col>
          ))}
        </Row>
      </>
    );
  }

  const rooms = data ?? [];

  return (
    <>
      <PageHeader
        title="جلسات من"
        subtitle="جلسه‌هایی که به آن‌ها دعوت شده‌اید یا ارائه‌دهندهٔ آن‌ها هستید"
      />

      {rooms.length === 0 ? (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="هنوز به جلسه‌ای دعوت نشده‌اید. هر جلسه‌ای که به آن دعوت شوید، همین‌جا نمایش داده می‌شود."
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {rooms.map((room, i) => {
            // Staggered, but capped: past about six cards the delay stops helping and starts
            // looking like the page is loading slowly.
            const delay = Math.min(i, 6) * MOTION.stagger;
            return (
              <Col key={room.id} xs={24} md={12} lg={8}>
                <motion.div
                  {...(reduced
                    ? { initial: false as const }
                    : {
                        initial: { opacity: 0, y: MOTION.rise },
                        animate: { opacity: 1, y: 0 },
                        transition: { duration: MOTION.enter, ease: MOTION.ease, delay },
                      })}
                  style={{ height: "100%" }}
                >
                  <MeetingCard room={room} now={now} delay={delay} />
                </motion.div>
              </Col>
            );
          })}
        </Row>
      )}
    </>
  );
}
