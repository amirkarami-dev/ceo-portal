import { lazy, Suspense, useEffect, useState } from "react";
import { Alert, Button, Drawer, Result, Space, Tabs, Tag, Typography, theme } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { LiveKitRoom, RoomAudioRenderer } from "@livekit/components-react";
import "@livekit/components-styles";
import { ChatPanel } from "./ChatPanel";
import { MeetingBar } from "./MeetingBar";
import { MeetingStage } from "./MeetingStage";
import { ParticipantsPanel } from "./ParticipantsPanel";
import { BoardBoundary } from "../whiteboard/BoardBoundary";
import { setRoomToken } from "../../lib/api";
import { RoomType, TYPE_LABELS, type RoomJoinResult } from "../../lib/types";

/** Lazy: Excalidraw and its stylesheet must not be in the chunk every guest downloads. */
const WhiteboardStage = lazy(() =>
  import("../whiteboard/WhiteboardStage").then((m) => ({ default: m.WhiteboardStage })),
);

type Phase = "connecting" | "connected" | "failed" | "left";

/**
 * The meeting itself.
 *
 * Both ways in end here — a member from «جلسات من» and a guest from a link — because both already hold
 * the same thing by this point: a signed token that says which room and what they may do. Nothing on
 * this screen re-derives permission; `canPublish` comes from the token, and the media server is what
 * actually refuses a track it does not allow.
 *
 * Camera and microphone start **off**. Opening either the moment somebody arrives is the behaviour
 * every conferencing product has been complained about for, and in a public ارائه it would put a
 * stranger's living room on screen before they had looked at the page.
 */
export function MeetingScreen({
  result,
  onLeave,
}: {
  result: RoomJoinResult;
  onLeave: () => void;
}) {
  const { token } = theme.useToken();
  const [phase, setPhase] = useState<Phase>("connecting");
  const [panelOpen, setPanelOpen] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);

  // A guest has no account, so chat is authenticated by the media token instead. Scoped to this
  // screen and cleared on the way out — a token left set would travel on requests that have nothing
  // to do with this meeting.
  useEffect(() => {
    setRoomToken(result.token);
    return () => setRoomToken(null);
  }, [result.token]);

  if (phase === "left") {
    return (
      <div style={{ display: "grid", placeItems: "center", minHeight: "100vh", padding: 16 }}>
        <Result
          status="success"
          title="از جلسه خارج شدید"
          extra={
            <Button type="primary" onClick={onLeave}>
              بازگشت
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: token.colorBgLayout }}>
      {/* Title bar. Kept outside LiveKitRoom so it still reads correctly while connecting or after a
          failure — the person needs to know which meeting they are looking at either way. */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          background: token.colorBgContainer,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Typography.Text strong style={{ fontSize: 15 }}>
          {result.roomName}
        </Typography.Text>
        <Tag color={result.type === RoomType.Presentation ? "purple" : "default"}>
          {TYPE_LABELS[result.type]}
        </Tag>
        {!result.canPublish && <Tag>تماشاگر</Tag>}
        <div style={{ flex: 1 }} />
        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
          {result.displayName}
        </Typography.Text>
      </div>

      {phase === "failed" ? (
        <div style={{ display: "grid", placeItems: "center", flex: 1, padding: 16 }}>
          <Result
            status="warning"
            title="اتصال به سرور تصویر برقرار نشد"
            subTitle="ورود شما پذیرفته شد، اما ارتباط با سرویس ویدیو ممکن نشد."
            extra={
              <Space>
                {/* A reload re-runs the whole join, which mints a fresh token — the old one may simply
                    have expired while the page sat open. */}
                <Button type="primary" icon={<ReloadOutlined />} onClick={() => window.location.reload()}>
                  تلاش دوباره
                </Button>
                <Button onClick={onLeave}>بازگشت</Button>
              </Space>
            }
          />
        </div>
      ) : (
        <LiveKitRoom
          token={result.token}
          serverUrl={result.wsUrl}
          connect
          // Never auto-open a device. See the note on this component.
          audio={false}
          video={false}
          onConnected={() => setPhase("connected")}
          onDisconnected={() => setPhase((p) => (p === "failed" ? p : "left"))}
          onError={(e) => {
            // Console, NOT the screen. The SDK's message is English and carries infrastructure
            // detail — a real failure printed «could not establish signal connection: invalid API
            // key: APIlocaldev» straight to a guest at a public webinar. It is the public half of
            // the key pair rather than a secret, but naming our media server's key to a stranger
            // buys nothing and the sentence means nothing to them either.
            console.error("[room] media connection failed:", e);
            setPhase("failed");
          }}
          style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
        >
          {/* Plays every remote audio track. Without it a meeting is silent and nothing says why. */}
          <RoomAudioRenderer />

          <div style={{ flex: 1, minHeight: 0, padding: 8 }}>
            {phase === "connecting" ? (
              <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
                <Typography.Text type="secondary">در حال اتصال به جلسه…</Typography.Text>
              </div>
            ) : boardOpen ? (
              <BoardBoundary>
                <Suspense
                  fallback={
                    <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
                      <Typography.Text type="secondary">در حال بارگذاری تخته…</Typography.Text>
                    </div>
                  }
                >
                  <WhiteboardStage canDraw={result.canPublish} />
                </Suspense>
              </BoardBoundary>
            ) : (
              <MeetingStage />
            )}
          </div>

          {!result.canPublish && result.type === RoomType.Presentation && (
            <Alert
              type="info"
              banner
              message="در این ارائه فقط ارائه‌دهنده صحبت می‌کند. شما می‌بینید و می‌شنوید."
            />
          )}

          <MeetingBar
            canPublish={result.canPublish}
            participantsOpen={panelOpen}
            onToggleParticipants={() => setPanelOpen((o) => !o)}
            boardOpen={boardOpen}
            onToggleBoard={() => setBoardOpen((o) => !o)}
            onLeave={() => setPhase("left")}
          />

          <Drawer
            placement="left"
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            width={340}
            styles={{ body: { display: "flex", flexDirection: "column", paddingTop: 0 } }}
          >
            {/* Chat first: in an ارائه the audience cannot speak, so this is the only way they have
                of saying anything at all. */}
            <Tabs
              defaultActiveKey="chat"
              style={{ flex: 1, minHeight: 0 }}
              // The panel is a column and the chat inside it scrolls; without this the tab body
              // grows instead and the message box slides off the bottom of the drawer.
              className="room-dock-tabs"
              items={[
                {
                  key: "chat",
                  label: "گفتگو",
                  children: <ChatPanel roomId={result.roomId} open={panelOpen} />,
                },
                {
                  key: "people",
                  label: "شرکت‌کنندگان",
                  children: <ParticipantsPanel presenterName={result.presenterName} />,
                },
              ]}
            />
          </Drawer>
        </LiveKitRoom>
      )}
    </div>
  );
}
