import { useEffect, useState } from "react";
import { Typography } from "antd";

const fa = (n: number) => n.toLocaleString("fa-IR", { minimumIntegerDigits: 2, useGrouping: false });

function parts(msLeft: number) {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/**
 * Ticks down to an instant and calls `onElapsed` **once** when it arrives.
 *
 * The clock here decides only when to re-ask the server; it never decides whether voting is open.
 * The browser clock can be wrong by minutes or years, so treating it as the authority would either
 * open a ballot early — which the API would then refuse, after the voter had already chosen — or hide
 * one that is genuinely open. `onElapsed` refetches and the server's `phase` wins.
 */
export function Countdown({
  to,
  prefix,
  onElapsed,
}: {
  /** ISO instant. */
  to: string;
  prefix: string;
  onElapsed?: () => void;
}) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // A malformed instant would otherwise render "NaN" and fire onElapsed in a loop.
    if (!Number.isFinite(target)) return;

    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [target]);

  useEffect(() => {
    if (!Number.isFinite(target)) return;
    if (now < target) return;

    onElapsed?.();
    // Deliberately keyed on crossing the boundary, not on `now`: without the guard this fires every
    // second after the deadline and hammers the API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [now >= target, target]);

  if (!Number.isFinite(target)) return null;

  const { days, hours, minutes, seconds } = parts(target - now);

  return (
    <Typography.Text type="secondary" style={{ fontSize: 13 }}>
      {prefix}{" "}
      <span dir="ltr" style={{ fontVariantNumeric: "tabular-nums", unicodeBidi: "isolate" }}>
        {days > 0 && `${days.toLocaleString("fa-IR")} روز و `}
        {fa(hours)}:{fa(minutes)}:{fa(seconds)}
      </span>
    </Typography.Text>
  );
}
