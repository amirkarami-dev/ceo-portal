import { Button, Card, Col, Empty, Row, Skeleton, Space, Tag, Typography, theme } from "antd";
import {
  ArrowLeftOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "../../components/PageHeader";
import { useMyRooms } from "../../lib/queries";
import { RoomType, TYPE_LABELS, fa, type MyRoom } from "../../lib/types";

/** Jalali date + time of day, in Iran time, from the instant the server sent. */
const WHEN = new Intl.DateTimeFormat("fa-IR", {
  dateStyle: "full",
  timeStyle: "short",
  timeZone: "Asia/Tehran",
});

function MeetingCard({ room }: { room: MyRoom }) {
  const { token } = theme.useToken();
  const navigate = useNavigate();
  const startsAt = new Date(room.startsAtUtc);

  return (
    <Card
      styles={{ body: { padding: 18 } }}
      style={{
        height: "100%",
        // The one that is running right now should be findable without reading anything.
        borderColor: room.canJoinNow ? token.colorPrimary : undefined,
      }}
    >
      <Space direction="vertical" size={10} style={{ width: "100%" }}>
        <Space size={6} wrap>
          <Tag color={room.type === RoomType.Presentation ? "purple" : "default"}>
            {TYPE_LABELS[room.type]}
          </Tag>
          {room.isPresenter && <Tag color="gold">شما ارائه‌دهنده‌اید</Tag>}
          {room.canJoinNow ? (
            <Tag color="green">در حال برگزاری</Tag>
          ) : (
            <Tag>هنوز شروع نشده</Tag>
          )}
        </Space>

        <Typography.Title level={5} style={{ margin: 0 }}>
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
            <span className="mun-live-dot" />
            <TeamOutlined />
            <span>{fa(room.liveCount)} نفر داخل جلسه</span>
          </Space>
        )}

        {/* `canJoinNow` is the SERVER's verdict, never re-derived from the browser clock. The button
            is hidden rather than disabled before then: the card already says when it starts, so a
            greyed button adds nothing but something to press at. */}
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
            description="در حال حاضر جلسه‌ای برای شما ثبت نشده است"
          />
        </Card>
      ) : (
        <Row gutter={[16, 16]}>
          {rooms.map((room, i) => (
            <Col key={room.id} xs={24} md={12} lg={8}>
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                // Staggered, but capped: past about six cards the delay stops helping and starts
                // looking like the page is loading slowly.
                transition={{ duration: 0.25, delay: Math.min(i, 6) * 0.04 }}
                style={{ height: "100%" }}
              >
                <MeetingCard room={room} />
              </motion.div>
            </Col>
          ))}
        </Row>
      )}
    </>
  );
}
