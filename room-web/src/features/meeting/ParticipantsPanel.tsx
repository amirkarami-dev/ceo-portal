import { List, Space, Tag, Typography, theme } from "antd";
import { AudioMutedOutlined, AudioOutlined, VideoCameraOutlined } from "@ant-design/icons";
import { useParticipants } from "@livekit/components-react";
import { Track } from "livekit-client";
import { isGuest } from "../../lib/types";

/**
 * Who is in the room.
 *
 * <b>Every link-joined participant is marked مهمان</b>, and that marker is not decoration. A guest
 * types their own display name, so nothing stops them typing «مدیر سازمان» — the design accepts that
 * and contains it here: the identity prefix is minted by the server (`guest-…`) and cannot be typed,
 * so the tag is the one thing on screen a guest cannot forge.
 */
export function ParticipantsPanel({ presenterName }: { presenterName: string | null }) {
  const { token } = theme.useToken();
  const participants = useParticipants();

  return (
    <List
      size="small"
      dataSource={participants}
      locale={{ emptyText: "کسی در جلسه نیست" }}
      renderItem={(p) => {
        const guest = isGuest(p.identity);
        const mic = p.getTrackPublication(Track.Source.Microphone);
        const cam = p.getTrackPublication(Track.Source.Camera);

        return (
          <List.Item>
            <Space style={{ width: "100%", justifyContent: "space-between" }}>
              <Space size={6} wrap>
                <Typography.Text style={{ fontSize: 13 }}>
                  {p.name || p.identity}
                </Typography.Text>
                {p.isLocal && <Tag color="blue">شما</Tag>}
                {guest && <Tag>مهمان</Tag>}
                {!guest && presenterName && p.name === presenterName && (
                  <Tag color="gold">ارائه‌دهنده</Tag>
                )}
              </Space>

              <Space size={10} style={{ color: token.colorTextSecondary }}>
                {/* Only meaningful for someone allowed to publish; an audience member has no
                    microphone to be muted, so nothing is drawn for them. */}
                {p.permissions?.canPublish ? (
                  <>
                    {mic && !mic.isMuted ? (
                      <AudioOutlined style={{ color: token.colorSuccess }} />
                    ) : (
                      <AudioMutedOutlined />
                    )}
                    {cam && !cam.isMuted && (
                      <VideoCameraOutlined style={{ color: token.colorSuccess }} />
                    )}
                  </>
                ) : (
                  <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                    تماشاگر
                  </Typography.Text>
                )}
              </Space>
            </Space>
          </List.Item>
        );
      }}
    />
  );
}
