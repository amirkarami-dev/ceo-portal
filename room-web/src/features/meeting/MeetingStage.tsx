import { Empty, Typography } from "antd";
import {
  CarouselLayout,
  FocusLayout,
  GridLayout,
  ParticipantTile,
  useTracks,
} from "@livekit/components-react";
import { Track } from "livekit-client";

/**
 * The video area.
 *
 * A screen share takes the stage and the camera tiles shrink to a strip above it — sharing a screen is
 * always the thing people came to look at, and a grid that treated it as one more equal tile would
 * make the slides unreadable.
 *
 * `withPlaceholder` on the camera source keeps a tile for a participant whose camera is off, so the
 * grid does not reshuffle every time somebody toggles video. An audience member in an ارائه has no
 * camera track and no placeholder — otherwise a public webinar would render two hundred empty squares.
 */
export function MeetingStage() {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false },
  );

  const screenShare = tracks.find((t) => t.source === Track.Source.ScreenShare);
  const cameras = tracks.filter((t) => t.source === Track.Source.Camera);

  if (tracks.length === 0) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <Typography.Text type="secondary">
              هنوز کسی دوربین یا میکروفونش را باز نکرده است
            </Typography.Text>
          }
        />
      </div>
    );
  }

  if (screenShare) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
        {cameras.length > 0 && (
          <div style={{ height: 110, flex: "0 0 auto" }}>
            <CarouselLayout tracks={cameras}>
              <ParticipantTile />
            </CarouselLayout>
          </div>
        )}
        <div style={{ flex: 1, minHeight: 0 }}>
          <FocusLayout trackRef={screenShare} />
        </div>
      </div>
    );
  }

  return (
    <GridLayout tracks={cameras} style={{ height: "100%" }}>
      <ParticipantTile />
    </GridLayout>
  );
}
