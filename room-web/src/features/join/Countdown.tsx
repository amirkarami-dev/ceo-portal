import { useEffect, useMemo, useRef, useState } from "react";
import { Typography } from "antd";
import { motion, useReducedMotion } from "framer-motion";
import { MOTION } from "../../theme/motion";

const two = (n: number) =>
  n.toLocaleString("fa-IR", { minimumIntegerDigits: 2, useGrouping: false });

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
 * The wait in words, for a screen reader.
 *
 * The tiles tick once a second and are hidden from assistive technology: a live
 * region firing every second is unusable, and a silent one is a wall of digits.
 * This says the same thing once, and is read when the reader reaches it.
 */
function spoken({ days, hours, minutes }: ReturnType<typeof parts>): string {
  const said = [
    days > 0 ? `${days.toLocaleString("fa-IR")} روز` : null,
    hours > 0 ? `${hours.toLocaleString("fa-IR")} ساعت` : null,
    `${minutes.toLocaleString("fa-IR")} دقیقه`,
  ].filter(Boolean);
  return `تا شروع جلسه ${said.join(" و ")} باقی مانده است`;
}

/** One unit of the countdown. The number animates; the label does not. */
function Unit({ value, label, flip }: { value: string; label: string; flip: boolean }) {
  const reduced = useReducedMotion() === true;

  return (
    <div className="room-cd-unit">
      <div className="room-cd-tile">
        {/*
          Enter-only, and deliberately NOT wrapped in <AnimatePresence>.

          An exit animation has to run to completion before the element is removed, and it is driven by
          requestAnimationFrame — which browsers pause for a tab that is not visible. This page is
          designed to sit open for twenty minutes while somebody waits for a webinar, so it WILL be in
          a background tab, and every second would then add a digit that never leaves: about 1200
          orphaned nodes stacked in one tile by the time they come back.

          Changing the key replaces the node outright, so there is no exit lifecycle to stall. The
          animation is only the arrival, which is all that was ever visible anyway.
        */}
        <motion.span
          key={value}
          className="room-cd-value"
          // Only the seconds move. Animating hours and minutes on every tick would make a page that
          // sits open for twenty minutes twitch constantly in the corner of somebody's eye.
          initial={flip && !reduced ? { y: 18, opacity: 0 } : false}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: MOTION.base, ease: MOTION.ease }}
        >
          {value}
        </motion.span>
      </div>
      <span className="room-cd-label">{label}</span>
    </div>
  );
}

/**
 * Counts down to the moment the doors open, and calls `onElapsed` **once** when it arrives.
 *
 * <b>The server's clock is the reference, not the device's.</b> A laptop whose time is an hour out —
 * which is common enough on a machine that has been asleep, and universal on a phone with the wrong
 * time zone — would otherwise count down to the wrong moment, or straight past it, and the guest
 * would sit watching a timer that never reaches zero. So the remaining time is measured once against
 * `serverNow`, converted to a local deadline, and counted down from there: a local clock is unreliable
 * for what time it is, but perfectly good at measuring how much time has passed.
 *
 * The clock here decides only when to re-ask the server. It never decides whether the meeting is open
 * — `onElapsed` refetches and the server's own verdict wins.
 */
export function Countdown({
  to,
  serverNow,
  onElapsed,
}: {
  /** ISO instant the doors open. */
  to: string;
  /** ISO instant, as the server reported it in the same response as `to`. */
  serverNow: string;
  onElapsed?: () => void;
}) {
  // Computed once per (to, serverNow) pair — i.e. once per response from the server.
  const deadline = useMemo(() => {
    const target = new Date(to).getTime();
    const server = new Date(serverNow).getTime();
    if (!Number.isFinite(target) || !Number.isFinite(server)) return NaN;
    return Date.now() + (target - server);
  }, [to, serverNow]);

  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // A malformed instant would otherwise render "NaN" and fire onElapsed in a loop.
    if (!Number.isFinite(deadline)) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [deadline]);

  // Fired once per deadline, not once per tick. Without the ref this calls the API every second for
  // as long as the page stays open past zero.
  const firedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!Number.isFinite(deadline) || now < deadline) return;
    if (firedFor.current === deadline) return;
    firedFor.current = deadline;
    onElapsed?.();
  }, [now, deadline, onElapsed]);

  if (!Number.isFinite(deadline)) return null;

  const left = parts(deadline - now);

  return (
    <div style={{ textAlign: "center" }}>
      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        تا شروع جلسه
      </Typography.Text>

      <p className="sr-only">{spoken(left)}</p>

      {/* dir="ltr" so the units read روز · ساعت · دقیقه · ثانیه left to right, the way a clock is
          read everywhere including in Persian — an RTL flow would put the seconds first. */}
      <div className="room-cd" dir="ltr" style={{ unicodeBidi: "isolate" }} aria-hidden="true">
        {left.days > 0 && (
          <Unit value={left.days.toLocaleString("fa-IR")} label="روز" flip={false} />
        )}
        <Unit value={two(left.hours)} label="ساعت" flip={false} />
        <Unit value={two(left.minutes)} label="دقیقه" flip={false} />
        <Unit value={two(left.seconds)} label="ثانیه" flip />
      </div>
    </div>
  );
}
