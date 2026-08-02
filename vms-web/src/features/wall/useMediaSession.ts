import { useCallback, useEffect, useRef, useState } from "react";
import { openMediaSession } from "../../lib/queries";
import { ApiError } from "../../lib/api";

type State = { status: "opening" | "ready" | "failed"; error?: string };

/**
 * Holds a media session open for as long as the wall is on screen.
 *
 * The gateway is a different host and judges every request on a cookie, so nothing can play until
 * that cookie exists. Tiles must therefore wait for `ready` rather than mount and hope — a tile that
 * connects first gets a 401 and, to the person looking at it, that is indistinguishable from a
 * camera being down.
 */
export function useMediaSession(): State & { retry: () => void } {
  const [state, setState] = useState<State>({ status: "opening" });
  const timer = useRef<number | undefined>(undefined);
  const [attempt, setAttempt] = useState(0);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    const open = async () => {
      try {
        const session = await openMediaSession();
        if (cancelled) return;
        setState({ status: "ready" });

        // Renew at three quarters of the life, with a floor. Waiting for expiry would drop every
        // tile at once, and a wall is exactly the page somebody leaves open all morning.
        const ms = Math.max(30_000, session.ttlSeconds * 750);
        timer.current = window.setTimeout(() => void open(), ms);
      } catch (e) {
        if (cancelled) return;
        setState({
          status: "failed",
          error:
            e instanceof ApiError
              ? e.message
              : "ارتباط با سرویس تصویر برقرار نشد",
        });
      }
    };

    void open();

    return () => {
      cancelled = true;
      window.clearTimeout(timer.current);
    };
  }, [attempt]);

  return { ...state, retry };
}
