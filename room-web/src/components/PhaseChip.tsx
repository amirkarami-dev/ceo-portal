import { phaseColor, withAlpha, type MeetingPhase } from "../theme/tokens";
import { useThemeMode } from "../theme/useThemeMode";

/**
 * The word beside the colour. Colour never says this on its own.
 *
 * «زمان آن گذشته است» rather than «پایان یافت»: nothing reports that a meeting
 * ended, so this is read off the schedule. The room may well still be open — see
 * the note in lib/schedule.ts.
 */
const PHASE_WORD: Record<MeetingPhase, string> = {
  live: "در حال برگزاری",
  soon: "به‌زودی",
  upcoming: "برگزار نشده",
  ended: "زمان آن گذشته است",
};

/** Where a meeting sits in its own life, said in one small pill. */
export function PhaseChip({ phase, relative }: { phase: MeetingPhase; relative: string | null }) {
  const { mode } = useThemeMode();
  const color = phaseColor(mode, phase);
  // For anything still ahead, the wait itself is the more useful label.
  const text =
    phase === "live" || phase === "ended" ? PHASE_WORD[phase] : (relative ?? PHASE_WORD.soon);

  return (
    // 0.09, not a rounder 0.12: the text sits on a tint of its own colour, and a
    // heavier tint pulls the background toward the text until it stops being
    // readable. At 0.12 the quietest phase measured 4.43:1 on dark; at 0.09 the
    // worst of the eight phase/theme combinations is 4.64:1.
    <span
      className="room-chip"
      style={{
        color,
        background: withAlpha(color, 0.09),
        boxShadow: `inset 0 0 0 1px ${withAlpha(color, 0.28)}`,
      }}
    >
      {phase === "live" && <span className="room-live-dot" />}
      {text}
    </span>
  );
}
