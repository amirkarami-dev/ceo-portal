import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Input, Space, Tag, Typography, theme } from "antd";
import { SendOutlined } from "@ant-design/icons";
import { useDataChannel, useRoomContext } from "@livekit/components-react";
import { useRoomMessages, useSendRoomMessage } from "../../lib/queries";
import { ApiError } from "../../lib/api";
import type { ChatWireMessage, RoomMessage } from "../../lib/types";

const TIME = new Intl.DateTimeFormat("fa-IR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Tehran",
});

const CHAT_TOPIC = "chat";

/**
 * The meeting chat.
 *
 * <b>Two paths, one authority.</b> A line is POSTed to the API, which saves it and answers with the
 * saved row; the sender then broadcasts that row over the media server's data channel so everybody
 * else sees it immediately. History comes from the API when the panel opens.
 *
 * The alternative — polling — would cost every participant a request every few seconds against a rate
 * limit they share with everyone behind the same NAT, which is exactly the case a public webinar
 * creates. The alternative in the other direction — data channel only — would not survive a reload,
 * which is the whole point of the step.
 *
 * De-duplication is by row id, because a message can legitimately arrive twice: once from the POST
 * response for the sender, once from the broadcast for everybody. Ids come from the database, so they
 * cannot collide.
 */
export function ChatPanel({ roomId, open }: { roomId: number; open: boolean }) {
  const { token } = theme.useToken();
  const room = useRoomContext();
  const myIdentity = room.localParticipant?.identity ?? "";

  const { data: history, isLoading, error } = useRoomMessages(roomId, open);
  const send = useSendRoomMessage(roomId);

  const [live, setLive] = useState<RoomMessage[]>([]);
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement | null>(null);

  const onData = useCallback((msg: { payload: Uint8Array }) => {
    try {
      const wire = JSON.parse(new TextDecoder().decode(msg.payload)) as ChatWireMessage;
      if (wire?.kind !== "chat" || typeof wire.id !== "number") return;

      setLive((prev) =>
        prev.some((m) => m.id === wire.id)
          ? prev
          : [...prev, {
              id: wire.id,
              senderId: wire.senderId,
              senderName: wire.senderName,
              isGuest: wire.isGuest,
              text: wire.text,
              sentAtUtc: wire.sentAtUtc,
            }],
      );
    } catch {
      // Anything that is not our own JSON is not ours to render. The data channel is shared, and a
      // participant can put whatever they like on it — this is the boundary.
    }
  }, []);

  const { send: publish } = useDataChannel(CHAT_TOPIC, onData);

  // History plus anything that arrived since, de-duplicated on the database id.
  const messages = useMemo(() => {
    const seen = new Map<number, RoomMessage>();
    for (const m of history ?? []) seen.set(m.id, m);
    for (const m of live) seen.set(m.id, m);
    return [...seen.values()].sort((a, b) => a.id - b.id);
  }, [history, live]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const submit = () => {
    const body = text.trim();
    if (!body || send.isPending) return;

    send.mutate(body, {
      onSuccess: (saved) => {
        setText("");
        // Add locally first so the sender never waits on their own broadcast coming back.
        setLive((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]));

        const wire: ChatWireMessage = { kind: "chat", ...saved };
        try {
          void publish(new TextEncoder().encode(JSON.stringify(wire)), { reliable: true });
        } catch {
          // The line is already saved; a failed broadcast only means the others see it on their next
          // load rather than immediately. Not worth an error in the sender's face.
        }
      },
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", paddingInlineEnd: 4 }}>
        {isLoading && <Typography.Text type="secondary">در حال بارگذاری…</Typography.Text>}

        {error && (
          <Alert
            type="warning"
            showIcon
            message="گفتگو بارگذاری نشد"
            description={error instanceof ApiError ? error.message : undefined}
          />
        )}

        {!isLoading && !error && messages.length === 0 && (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            هنوز پیامی فرستاده نشده است.
          </Typography.Text>
        )}

        <Space direction="vertical" size={10} style={{ width: "100%" }}>
          {messages.map((m) => {
            const mine = m.senderId === myIdentity;
            return (
              <div key={m.id}>
                <Space size={6} wrap style={{ marginBottom: 2 }}>
                  <Typography.Text strong style={{ fontSize: 12 }}>
                    {mine ? "شما" : m.senderName}
                  </Typography.Text>
                  {/* Server-decided. A guest types their own display name, so this is the one label
                      on the line they cannot forge. */}
                  {m.isGuest && !mine && <Tag style={{ marginInlineEnd: 0 }}>مهمان</Tag>}
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    {TIME.format(new Date(m.sentAtUtc))}
                  </Typography.Text>
                </Space>
                <div
                  style={{
                    background: mine ? token.colorPrimaryBg : token.colorFillQuaternary,
                    borderRadius: 10,
                    padding: "8px 10px",
                    fontSize: 13,
                    // A message may have paragraphs, and must never break the panel's width.
                    whiteSpace: "pre-wrap",
                    overflowWrap: "anywhere",
                  }}
                >
                  {m.text}
                </div>
              </div>
            );
          })}
        </Space>
        <div ref={endRef} />
      </div>

      {send.error instanceof ApiError && (
        <Alert type="error" showIcon style={{ marginTop: 8 }} message={send.error.message} />
      )}

      <Space.Compact style={{ marginTop: 12 }}>
        <Input.TextArea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="پیام…"
          autoSize={{ minRows: 1, maxRows: 4 }}
          maxLength={4000}
          onPressEnter={(e) => {
            // Enter sends; Shift+Enter is a new line. A chat that needed a button click for every
            // line would be unusable during a live meeting.
            if (!e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button
          type="primary"
          icon={<SendOutlined />}
          loading={send.isPending}
          disabled={!text.trim()}
          onClick={submit}
        />
      </Space.Compact>
    </div>
  );
}
