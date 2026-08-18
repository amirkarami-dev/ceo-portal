import { useEffect, useState } from "react";

/**
 * A clock that ticks, so «۳ روز دیگر» does not sit there stale.
 *
 * The meetings query refetches every 30s, but react-query shares structure: when
 * nothing on the server changed the data reference is the same and React never
 * re-renders. Relative time is computed here, not there, so it needs its own tick.
 */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
