import { describe, expect, it } from "vitest";
import { describeSchedule, type ScheduleInput } from "./schedule";

const NOW = Date.parse("2026-08-18T10:00:00Z");
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** A room that opens 15 minutes before it starts, which is the usual grace. */
function room(startsInMs: number, over: Partial<ScheduleInput> = {}): ScheduleInput {
  const starts = NOW + startsInMs;
  return {
    startsAtUtc: new Date(starts).toISOString(),
    opensAtUtc: new Date(starts - 15 * MIN).toISOString(),
    durationMinutes: 60,
    canJoinNow: false,
    ...over,
  };
}

describe("describeSchedule", () => {
  it("leaves the rail empty for anything past the one-week horizon", () => {
    expect(describeSchedule(room(30 * DAY), NOW).fill).toBe(0);
    expect(describeSchedule(room(8 * DAY), NOW).fill).toBe(0);
  });

  it("fills the rail as the meeting comes closer", () => {
    const far = describeSchedule(room(6 * DAY), NOW).fill;
    const near = describeSchedule(room(2 * DAY), NOW).fill;
    const soon = describeSchedule(room(3 * HOUR), NOW).fill;
    expect(far).toBeLessThan(near);
    expect(near).toBeLessThan(soon);
    expect(soon).toBeLessThan(1);
  });

  it("turns gold inside the last hour before the doors open", () => {
    expect(describeSchedule(room(2 * HOUR), NOW).phase).toBe("upcoming");
    // Doors are 15 minutes before the start, so a start 70 minutes out is 55 to open.
    expect(describeSchedule(room(70 * MIN), NOW).phase).toBe("soon");
  });

  it("says it is live only while the server allows entry AND the time has not passed", () => {
    expect(describeSchedule(room(-10 * MIN, { canJoinNow: true }), NOW).phase).toBe("live");
  });

  /**
   * The one this exists for. `Room.IsOpenAt` has no close, so an old meeting still
   * answers `canJoinNow: true` and the list used to call it «در حال برگزاری».
   */
  it("calls a meeting from last month ended, even though the door is still open", () => {
    const old = describeSchedule(room(-30 * DAY, { canJoinNow: true }), NOW);
    expect(old.phase).toBe("ended");
    expect(old.relative).toBe("۳۰ روز پیش");
  });

  it("ends a meeting with no set length after the assumed two hours, not never", () => {
    const noLength = { durationMinutes: null, canJoinNow: true };
    expect(describeSchedule(room(-90 * MIN, noLength), NOW).phase).toBe("live");
    expect(describeSchedule(room(-3 * HOUR, noLength), NOW).phase).toBe("ended");
  });

  it("does not count down past zero when the server has not caught up yet", () => {
    // Doors opened five minutes ago by this clock; the server still says no.
    const waiting = describeSchedule(room(-4 * MIN), NOW);
    expect(waiting.phase).toBe("soon");
    expect(waiting.relative).toBeNull();
    expect(waiting.fill).toBe(1);
  });

  it("writes the wait in Persian, in the largest unit that still means something", () => {
    expect(describeSchedule(room(3 * DAY), NOW).relative).toBe("۳ روز دیگر");
    expect(describeSchedule(room(5 * HOUR), NOW).relative).toBe("۵ ساعت بعد");
    expect(describeSchedule(room(30 * MIN), NOW).relative).toBe("۱۵ دقیقه بعد");
  });
});
