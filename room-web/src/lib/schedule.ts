import type { MeetingPhase } from "../theme/tokens";

/**
 * Where a meeting sits in its own life, for display.
 *
 * WHY THIS IS NOT JUST `canJoinNow`
 * ---------------------------------
 * `Room.IsOpenAt` on the server is `now >= OpensAtUtc` — there is no close. Once a
 * room opens it stays open forever, and `GetMyRoomsQuery` applies no date filter,
 * so a meeting from last month arrives with `canJoinNow: true`. Reading that as
 * "live" is how the list ended up telling people a meeting three weeks old was in
 * progress.
 *
 * So the two questions are kept apart:
 *   - "may I go in?"  — `canJoinNow`, the server's word, and nothing here touches it
 *   - "is it now?"    — the schedule, which the browser can read for itself
 *
 * Both can be true at once, and that is not a contradiction: the meeting's time has
 * passed and the door happens to still be open.
 */

/** Anything further out than this reads as "not soon" and leaves the rail empty. */
const HORIZON_MS = 7 * 24 * 60 * 60 * 1000;

/** Inside this much of the doors opening, a meeting is worth getting ready for. */
const SOON_MS = 60 * 60 * 1000;

/**
 * Assumed length when none was set, for display only.
 *
 * Without it a meeting with no duration would read as "live" for ever. Two hours is
 * long enough not to cut a real meeting short on the card. It never reaches the join
 * button, which follows `canJoinNow` alone.
 */
const ASSUMED_MINUTES = 120;

export interface ScheduleInput {
  startsAtUtc: string;
  opensAtUtc: string;
  durationMinutes: number | null;
  /** The server's verdict on the door. Never re-derived here. */
  canJoinNow: boolean;
}

export interface ScheduleView {
  phase: MeetingPhase;
  /** 0..1. How full the rail is: nothing at a week out, full once it is time. */
  fill: number;
  /** Persian relative time — «۳ روز دیگر», «فردا», «دیروز». Null while it is live. */
  relative: string | null;
}

const RELATIVE = new Intl.RelativeTimeFormat("fa-IR", { numeric: "auto" });

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Largest unit that still says something useful: days, then hours, then minutes. */
function relativeFa(deltaMs: number): string {
  const size = Math.abs(deltaMs);
  if (size >= DAY) return RELATIVE.format(Math.round(deltaMs / DAY), "day");
  if (size >= HOUR) return RELATIVE.format(Math.round(deltaMs / HOUR), "hour");
  return RELATIVE.format(Math.round(deltaMs / MINUTE), "minute");
}

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

export function describeSchedule(room: ScheduleInput, nowMs: number): ScheduleView {
  const opens = Date.parse(room.opensAtUtc);
  const starts = Date.parse(room.startsAtUtc);
  const ends = starts + (room.durationMinutes ?? ASSUMED_MINUTES) * MINUTE;

  if (nowMs > ends) {
    return { phase: "ended", fill: 1, relative: relativeFa(starts - nowMs) };
  }
  if (room.canJoinNow) {
    return { phase: "live", fill: 1, relative: null };
  }

  const untilOpen = opens - nowMs;
  const fill = clamp01(1 - untilOpen / HORIZON_MS);

  // Past the opening time while the server still says no — a clock a little ahead,
  // or a poll that has not come back yet. Counting down past zero would be a lie,
  // so it just reads as "soon".
  if (untilOpen <= 0) return { phase: "soon", fill: 1, relative: null };

  return { phase: untilOpen <= SOON_MS ? "soon" : "upcoming", fill, relative: relativeFa(untilOpen) };
}
