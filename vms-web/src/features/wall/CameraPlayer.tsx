import { useEffect, useRef, useState } from "react";
import { MEDIA_BASE } from "../../lib/api";
import { acquireStream } from "./streamLease";

/**
 * The codecs we tell the gateway we can decode.
 *
 * H.265 first, because that is what the cameras actually send — verified in step 1, and it is the
 * reason WebRTC is not an option here at all (Chrome will not carry HEVC over WebRTC). The list is
 * filtered by what this browser really supports, so a machine with no hardware HEVC decoder simply
 * does not offer it and the gateway can answer with H.264 instead of sending frames nothing can
 * decode.
 *
 * Video only. No audio codec is offered because none is ever requested — see the `video=` filter on
 * the socket URL below. Offering one and then filtering it out is the kind of contradiction that
 * makes a negotiation fail in a way nothing reports.
 */
const CANDIDATES = [
  'hvc1.1.6.L153.B0',
  'hev1.1.6.L153.B0',
  'avc1.640029',
  'avc1.64002A',
  'avc1.4D401E',
];

function supportedCodecs(): string {
  if (typeof MediaSource === "undefined") return "";
  return CANDIDATES.filter((c) => MediaSource.isTypeSupported(`video/mp4; codecs="${c}"`)).join();
}

export type PlayerState = "connecting" | "playing" | "stalled" | "unsupported" | "error";

interface Props {
  streamKey: string;
  /** False parks the player: no socket, no camera connection. */
  active: boolean;
  onState?: (state: PlayerState) => void;
}

/**
 * One live tile, over MSE.
 *
 * <p>Deliberately not go2rtc's own <code>video-stream.js</code>: that would mean serving a script
 * from the gateway, and the gateway's own routes are being narrowed down to the three the player
 * needs. Speaking its WebSocket protocol directly keeps the media host to data only.</p>
 *
 * <p><b>`active` is a bandwidth control, not a UI nicety.</b> A tile that is connected is a camera
 * being pulled, and a camera site has room for one puller at about 0.41 Mbit/s. Off-screen tiles,
 * other pages and hidden tabs must all disconnect.</p>
 */
export function CameraPlayer({ streamKey, active, onState }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [state, setState] = useState<PlayerState>("connecting");

  const report = useRef(onState);
  report.current = onState;

  useEffect(() => {
    const set = (s: PlayerState) => {
      setState(s);
      report.current?.(s);
    };

    if (!active) return;

    const video = videoRef.current;
    if (!video) return;

    const codecs = supportedCodecs();
    if (!codecs) {
      set("unsupported");
      return;
    }

    let socket: WebSocket | null = null;
    let mediaSource: MediaSource | null = null;
    let sourceBuffer: SourceBuffer | null = null;
    let disposed = false;
    const queue: ArrayBuffer[] = [];

    /** Everything that has to stop, whether we are unmounting or being preempted. */
    const teardown = () => {
      disposed = true;
      try {
        socket?.close();
      } catch {
        /* already closing */
      }
      try {
        if (mediaSource && mediaSource.readyState === "open") mediaSource.endOfStream();
      } catch {
        /* nothing to end */
      }
    };

    // At most one connection per camera in this tab. If a second player wants the same stream — the
    // fullscreen modal over a tile that is still on screen, or StrictMode's double mount — this one
    // gives it up rather than doubling the pull. See streamLease.ts.
    const lease = acquireStream(streamKey, () => {
      teardown();
      set("connecting");
    });

    const drain = () => {
      if (!sourceBuffer || sourceBuffer.updating || queue.length === 0) return;
      try {
        sourceBuffer.appendBuffer(queue.shift() as ArrayBuffer);
      } catch {
        // QuotaExceeded on a long-running tile. Dropping the backlog and letting the trim below
        // catch up is better than tearing the socket down and re-dialling the camera.
        queue.length = 0;
      }
    };

    /** Keeps at most a few seconds behind the playhead, or a wall left open all day grows for ever. */
    const trim = () => {
      if (!sourceBuffer || sourceBuffer.updating || !video) return;
      const buffered = sourceBuffer.buffered;
      if (buffered.length === 0) return;
      const keepFrom = video.currentTime - 5;
      if (keepFrom > buffered.start(0) + 1) {
        try {
          sourceBuffer.remove(buffered.start(0), keepFrom);
        } catch {
          /* mid-update; the next tick will do it */
        }
      }
    };

    mediaSource = new MediaSource();
    video.src = URL.createObjectURL(mediaSource);

    const onSourceOpen = () => {
      if (disposed || !mediaSource) return;
      URL.revokeObjectURL(video.src);

      const url = new URL(`${MEDIA_BASE}/api/ws`);
      url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
      url.searchParams.set("src", streamKey);

      // Video only, and this is not an optimisation — without it the tile stays black.
      //
      // The cameras publish three tracks: H.265 video, PCMA audio and an ONVIF metadata track. Ask
      // for all of them and MSE receives the init segment, reports the right dimensions, and then
      // never paints a frame. Naming the video codecs restricts the negotiation to video, which is
      // exactly what go2rtc's own player does with `&video=h265` — the form Amir confirmed working.
      //
      // Both codecs, not just H.265: a camera switched to H.264 later must not go dark because this
      // string was pinned to what the estate happened to publish today.
      url.searchParams.set("video", "h265,h264");

      socket = new WebSocket(url.toString());
      socket.binaryType = "arraybuffer";

      socket.onopen = () => socket?.send(JSON.stringify({ type: "mse", value: codecs }));

      socket.onmessage = (event: MessageEvent<string | ArrayBuffer>) => {
        if (disposed) return;

        if (typeof event.data === "string") {
          const message = JSON.parse(event.data) as { type: string; value: string };
          if (message.type !== "mse" || !mediaSource || mediaSource.readyState !== "open") return;
          try {
            sourceBuffer = mediaSource.addSourceBuffer(message.value);
            sourceBuffer.mode = "segments";
            sourceBuffer.addEventListener("updateend", () => {
              drain();
              trim();
            });
          } catch {
            set("unsupported");
          }
          return;
        }

        queue.push(event.data);
        drain();
      };

      // Any close is a close: the browser does not tell us whether the gateway refused the cookie or
      // the camera went away, and for the person looking at the tile the difference does not change
      // what they can do about it.
      socket.onerror = () => set("error");
      socket.onclose = () => {
        if (!disposed) set((videoRef.current?.readyState ?? 0) > 2 ? "stalled" : "error");
      };
    };

    mediaSource.addEventListener("sourceopen", onSourceOpen, { once: true });

    const onPlaying = () => set("playing");
    const onWaiting = () => set("stalled");
    video.addEventListener("playing", onPlaying);
    video.addEventListener("waiting", onWaiting);

    // A live tile must never fall behind. If the buffer runs ahead — a tab throttled in the
    // background, a stall that recovered — jump to the front rather than replaying old footage.
    const catchUp = window.setInterval(() => {
      if (!video.buffered.length) return;
      const end = video.buffered.end(video.buffered.length - 1);
      if (end - video.currentTime > 5) video.currentTime = end - 0.5;
    }, 3000);

    void video.play().catch(() => {
      /* autoplay is allowed while muted; a rejection here is a paused tile, not a crash */
    });

    return () => {
      teardown();
      lease.release();
      window.clearInterval(catchUp);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("waiting", onWaiting);
      video.removeAttribute("src");
      video.load();
    };
  }, [streamKey, active]);

  return (
    <video
      ref={videoRef}
      // Always muted, and there is no option to unmute: the service carries no audio at all, so
      // the only thing an unmuted <video> would achieve is letting the browser refuse to autoplay
      // it. A tile that needs a click to start is a tile that looks broken.
      muted
      playsInline
      // Cameras are 4:3-ish (704x576). `contain` keeps the whole frame rather than cropping the
      // edges of a scene somebody put the camera there to watch.
      style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000", display: "block" }}
      data-state={state}
    />
  );
}
