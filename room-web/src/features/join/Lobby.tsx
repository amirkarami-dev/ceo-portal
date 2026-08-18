import { Button, Space, Tag, Typography, theme } from "antd";
import {
  ArrowLeftOutlined,
  AudioMutedOutlined,
  CheckCircleFilled,
  VideoCameraOutlined,
} from "@ant-design/icons";
import type { ReactNode } from "react";
import { isGuest, type RoomJoinResult } from "../../lib/types";

/** One labelled fact. Hairlines between them, none after the last. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 0",
        borderBottom: "1px solid var(--line)",
      }}
    >
      <span style={{ fontSize: 13, color: "var(--muted)" }}>{label}</span>
      <span style={{ textAlign: "end" }}>{children}</span>
    </div>
  );
}

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
          borderRadius: 18,
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
        {/* Not «به جلسه وارد شدید» — nobody has entered anything yet, and saying so
            directly above a button that says «ورود» tells two different stories. */}
        <Typography.Title
          level={1}
          style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.4px" }}
        >
          آمادهٔ ورود هستید
        </Typography.Title>
        <Typography.Text type="secondary">{result.roomName}</Typography.Text>
      </Space>

      <div style={{ textAlign: "start" }}>
        <Fact label="نام شما در جلسه">
          <Space size={6}>
            <Typography.Text strong>{result.displayName}</Typography.Text>
            {/* Everyone who came in through a link is marked. A guest types their own name, so
                nothing stops them typing «مدیر سازمان» — this is what keeps that from working. */}
            {guest && <Tag bordered={false}>مهمان</Tag>}
          </Space>
        </Fact>

        <Fact label="اجازهٔ صحبت">
          {result.canPublish ? (
            <Tag bordered={false} icon={<VideoCameraOutlined />} color="green">
              میکروفون، دوربین و اشتراک صفحه
            </Tag>
          ) : (
            <Tag bordered={false} icon={<AudioMutedOutlined />}>
              فقط تماشا و گفتگوی متنی
            </Tag>
          )}
        </Fact>

        {result.presenterName && (
          <Fact label="ارائه‌دهنده">
            <Typography.Text>{result.presenterName}</Typography.Text>
          </Fact>
        )}
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
