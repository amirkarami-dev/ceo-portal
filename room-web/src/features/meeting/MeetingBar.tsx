import { Badge, Button, Space, Tooltip, Typography, theme } from "antd";
import {
  AudioMutedOutlined,
  AudioOutlined,
  DesktopOutlined,
  HighlightOutlined,
  LogoutOutlined,
  TeamOutlined,
  VideoCameraAddOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { useLocalParticipant, useParticipants } from "@livekit/components-react";

/**
 * The meeting controls.
 *
 * <b>The publish buttons are not rendered at all for an audience member</b> — not disabled, not
 * greyed, absent. A disabled microphone button says «you could speak, but not now», which is the wrong
 * story: in an ارائه an audience member is never going to speak, and offering the control invites
 * people to hunt for the setting that unlocks it.
 *
 * This is presentation only. The media server refuses a track the token does not allow, so a tampered
 * front end that drew the buttons anyway would still publish nothing — see `Room.MayPublish`.
 */
export function MeetingBar({
  canPublish,
  participantsOpen,
  onToggleParticipants,
  boardOpen,
  onToggleBoard,
  onLeave,
}: {
  canPublish: boolean;
  participantsOpen: boolean;
  onToggleParticipants: () => void;
  boardOpen: boolean;
  onToggleBoard: () => void;
  onLeave: () => void;
}) {
  const { token } = theme.useToken();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } =
    useLocalParticipant();
  const participants = useParticipants();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "10px 16px",
        background: token.colorBgContainer,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        flexWrap: "wrap",
      }}
    >
      <Space size={8}>
        {canPublish ? (
          <>
            <Tooltip title={isMicrophoneEnabled ? "بستن میکروفون" : "باز کردن میکروفون"}>
              <Button
                shape="circle"
                size="large"
                type={isMicrophoneEnabled ? "primary" : "default"}
                danger={!isMicrophoneEnabled}
                aria-label={isMicrophoneEnabled ? "بستن میکروفون" : "باز کردن میکروفون"}
                icon={isMicrophoneEnabled ? <AudioOutlined /> : <AudioMutedOutlined />}
                onClick={() =>
                  void localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)
                }
              />
            </Tooltip>

            <Tooltip title={isCameraEnabled ? "بستن دوربین" : "باز کردن دوربین"}>
              <Button
                shape="circle"
                size="large"
                type={isCameraEnabled ? "primary" : "default"}
                aria-label={isCameraEnabled ? "بستن دوربین" : "باز کردن دوربین"}
                icon={isCameraEnabled ? <VideoCameraOutlined /> : <VideoCameraAddOutlined />}
                onClick={() => void localParticipant.setCameraEnabled(!isCameraEnabled)}
              />
            </Tooltip>

            <Tooltip title={isScreenShareEnabled ? "پایان اشتراک صفحه" : "اشتراک صفحه"}>
              <Button
                shape="circle"
                size="large"
                type={isScreenShareEnabled ? "primary" : "default"}
                aria-label={isScreenShareEnabled ? "پایان اشتراک صفحه" : "اشتراک صفحه"}
                icon={<DesktopOutlined />}
                onClick={() =>
                  void localParticipant.setScreenShareEnabled(!isScreenShareEnabled)
                }
              />
            </Tooltip>
          </>
        ) : (
          <Typography.Text type="secondary" style={{ fontSize: 13 }}>
            شما تماشاگر هستید؛ فقط ارائه‌دهنده صحبت می‌کند.
          </Typography.Text>
        )}
      </Space>

      <Space size={8}>
        {/* Everyone can OPEN the board, including an audience member — watching the presenter draw is
            the point. Whether they may draw on it is `canPublish`, decided inside the board itself. */}
        <Tooltip title={boardOpen ? "بستن تخته" : "تخته اشتراکی"}>
          <Button
            shape="circle"
            size="large"
            type={boardOpen ? "primary" : "default"}
            aria-label={boardOpen ? "بستن تخته" : "تخته اشتراکی"}
            icon={<HighlightOutlined />}
            onClick={onToggleBoard}
          />
        </Tooltip>

        <Tooltip title="شرکت‌کنندگان">
          <Badge count={participants.length} size="small" offset={[-4, 4]}>
            <Button
              shape="circle"
              size="large"
              type={participantsOpen ? "primary" : "default"}
              aria-label="شرکت‌کنندگان"
              icon={<TeamOutlined />}
              onClick={onToggleParticipants}
            />
          </Badge>
        </Tooltip>

        <Button danger type="primary" size="large" icon={<LogoutOutlined />} onClick={onLeave}>
          خروج
        </Button>
      </Space>
    </div>
  );
}
