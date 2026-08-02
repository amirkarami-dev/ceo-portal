import { useEffect, useRef, useState } from "react";
import { Badge, Button, Tooltip, Typography, theme } from "antd";
import { DisconnectOutlined, ExpandOutlined, WifiOutlined } from "@ant-design/icons";
import { lastSeenLabel } from "../../lib/lastSeen";
import { CameraPlayer, type PlayerState } from "./CameraPlayer";
import type { CameraListItem } from "../../lib/types";

const { Text } = Typography;

const LABEL: Record<PlayerState, string> = {
  connecting: "در حال اتصال…",
  playing: "زنده",
  stalled: "قطع و وصل",
  unsupported: "مرورگر این تصویر را پخش نمی‌کند",
  error: "بی‌ارتباط",
};

interface Props {
  camera: CameraListItem;
  /** False while the media session is still opening — no tile may connect before the cookie exists. */
  enabled: boolean;
  onExpand: (camera: CameraListItem) => void;
}

/**
 * One camera on the wall.
 *
 * <p>The tile connects only when it is <b>both</b> allowed and actually visible. Visibility is not
 * decoration: a connected tile is a live pull from a site with room for one, so a tile scrolled off
 * the page — or a page left open in a background tab — has to let go of the camera.</p>
 */
export function CameraTile({ camera, enabled, onExpand }: Props) {
  const { token } = theme.useToken();
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [onScreen, setOnScreen] = useState(false);
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  const [state, setState] = useState<PlayerState>("connecting");

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;

    // A generous margin so a tile is ready by the time it is looked at, but not so generous that a
    // long list quietly opens every camera in it.
    const observer = new IntersectionObserver((entries) => setOnScreen(entries[0]?.isIntersecting ?? false), {
      rootMargin: "150px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onVisibility = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const active = enabled && onScreen && visible;
  const live = state === "playing";

  return (
    <div
      ref={boxRef}
      style={{
        position: "relative",
        aspectRatio: "4 / 3",
        borderRadius: token.borderRadiusLG,
        overflow: "hidden",
        background: "#000",
        border: `1px solid ${token.colorBorderSecondary}`,
      }}
    >
      {active ? (
        <>
          <CameraPlayer streamKey={camera.streamKey} active onState={setState} />

          {/* A camera that is down must not look like a camera that is dark. Without this the tile
              is a black rectangle, which is also what a night-time courtyard looks like — and the
              person who has to go and fix it cannot tell the difference. */}
          {(state === "error" || state === "unsupported") && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                gap: 6,
                background: "rgba(0,0,0,.55)",
                textAlign: "center",
                padding: 12,
              }}
            >
              <div>
                <DisconnectOutlined style={{ color: "#ff7875", fontSize: 22 }} />
                <div style={{ color: "#fff", fontSize: 13, marginTop: 6 }}>{LABEL[state]}</div>
                <div style={{ color: "rgba(255,255,255,.65)", fontSize: 11, marginTop: 2 }}>
                  {/* The sweep's answer, not this tile's. A tile that just failed says nothing about
                      whether the camera has been gone for a minute or since Tuesday. */}
                  آخرین اتصال: {lastSeenLabel(camera.lastSeenUtc)}
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "grid",
            placeItems: "center",
            color: token.colorTextQuaternary,
            fontSize: 12,
          }}
        >
          {enabled ? "متوقف — خارج از دید" : "در انتظار سرویس تصویر"}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          insetInlineStart: 0,
          insetInlineEnd: 0,
          bottom: 0,
          padding: "18px 10px 8px",
          display: "flex",
          alignItems: "center",
          gap: 8,
          // A gradient rather than a solid bar: the caption has to stay readable over both a bright
          // courtyard and a dark stairwell without hiding part of the picture.
          background: "linear-gradient(to top, rgba(0,0,0,.72), rgba(0,0,0,0))",
        }}
      >
        <Badge status={live ? "processing" : state === "stalled" ? "warning" : "default"} />
        <Text style={{ color: "#fff", fontSize: 13, flex: 1 }} ellipsis>
          {camera.name}
        </Text>
        <Text style={{ color: "rgba(255,255,255,.65)", fontSize: 11 }}>{camera.cityName}</Text>

        {active && !live && (
          <Tooltip title={LABEL[state]}>
            <WifiOutlined style={{ color: "rgba(255,255,255,.65)", fontSize: 12 }} />
          </Tooltip>
        )}

        <Tooltip title="بزرگ‌نمایی">
          <Button
            size="small"
            type="text"
            icon={<ExpandOutlined style={{ color: "#fff" }} />}
            onClick={() => onExpand(camera)}
          />
        </Tooltip>
      </div>
    </div>
  );
}
