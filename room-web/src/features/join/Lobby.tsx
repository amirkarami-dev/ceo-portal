import { Button, Space, Tag, Typography, theme } from "antd";
import {
  ArrowLeftOutlined,
  AudioMutedOutlined,
  CheckCircleFilled,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { isGuest, type RoomJoinResult } from "../../lib/types";

/**
 * The last thing before the meeting: who you are and what you may do.
 *
 * Deliberately a separate step rather than dropping straight into video. A guest arriving from a chat
 * link should see their own display name and «تماشاگر» **before** anything touches a camera — both so
 * they can back out, and so the answer to «why can't I speak?» is on screen before they ask it.
 *
 * Nothing here re-derives permission. `canPublish` mirrors what the signed token already says, and the
 * media server is what enforces it — a UI that decided for itself could show a microphone the server
 * will refuse.
 */
export function Lobby({ result, onEnter }: { result: RoomJoinResult; onEnter: () => void }) {
  const { token } = theme.useToken();
  const guest = isGuest(result.identity);

  return (
    <Space direction="vertical" size={18} style={{ width: "100%", textAlign: "center" }}>
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: token.colorSuccessBg,
          color: token.colorSuccess,
          display: "grid",
          placeItems: "center",
          fontSize: 28,
          margin: "0 auto",
        }}
      >
        <CheckCircleFilled />
      </div>

      <Space direction="vertical" size={4} style={{ width: "100%" }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          به جلسه وارد شدید
        </Typography.Title>
        <Typography.Text type="secondary">{result.roomName}</Typography.Text>
      </Space>

      <div
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: 12,
          padding: 16,
          textAlign: "start",
        }}
      >
        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              نام شما در جلسه
            </Typography.Text>
            <Space size={6}>
              <Typography.Text strong>{result.displayName}</Typography.Text>
              {/* Everyone who came in through a link is marked. A guest types their own name, so
                  nothing stops them typing «مدیر سازمان» — this is what keeps that from working. */}
              {guest && <Tag>مهمان</Tag>}
            </Space>
          </Space>

          <Space style={{ justifyContent: "space-between", width: "100%" }}>
            <Typography.Text type="secondary" style={{ fontSize: 13 }}>
              اجازهٔ صحبت
            </Typography.Text>
            {result.canPublish ? (
              <Tag icon={<VideoCameraOutlined />} color="green">
                میکروفون، دوربین و اشتراک صفحه
              </Tag>
            ) : (
              <Tag icon={<AudioMutedOutlined />}>فقط تماشا و گفتگوی متنی</Tag>
            )}
          </Space>

          {result.presenterName && (
            <Space style={{ justifyContent: "space-between", width: "100%" }}>
              <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                ارائه‌دهنده
              </Typography.Text>
              <Typography.Text>{result.presenterName}</Typography.Text>
            </Space>
          )}
        </Space>
      </div>

      <Space direction="vertical" size={6} style={{ width: "100%" }}>
        <Button type="primary" size="large" block icon={<ArrowLeftOutlined />} onClick={onEnter}>
          ورود به تصویر و صدا
        </Button>
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {result.canPublish
            ? "میکروفون و دوربین شما بسته وارد می‌شوند؛ خودتان آن‌ها را باز کنید."
            : "برای تماشا به دوربین یا میکروفون نیازی نیست."}
        </Typography.Text>
      </Space>
    </Space>
  );
}
