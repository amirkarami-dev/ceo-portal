import { motion, useReducedMotion } from "framer-motion";
import { MOTION } from "../theme/motion";
import { phaseColor, type MeetingPhase } from "../theme/tokens";
import { useThemeMode } from "../theme/useThemeMode";

/**
 * Where now sits in a meeting's life, as a line down the card's leading edge.
 *
 * Empty at a week out, filling as it approaches, full and red while it is on, full
 * and grey once its time has passed. Position and colour answer "how soon?" before
 * any of the text is read.
 *
 * `aria-hidden`: the same thing is said in words next to it, so a screen reader
 * would otherwise hear it twice.
 */
export function TimeRail({
  phase,
  fill,
  delay = 0,
}: {
  phase: MeetingPhase;
  fill: number;
  /** Lines up with the card's own entrance, so the page arrives as one movement. */
  delay?: number;
}) {
  const { mode } = useThemeMode();
  const reduced = useReducedMotion() === true;
  const color = phaseColor(mode, phase);

  return (
    <span className="room-rail" aria-hidden="true">
      {reduced ? (
        <span className="room-rail-fill" style={{ background: color, transform: `scaleY(${fill})` }} />
      ) : (
        <motion.span
          className="room-rail-fill"
          style={{ background: color }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: fill }}
          transition={{ duration: MOTION.enter * 1.6, ease: MOTION.ease, delay }}
        />
      )}
    </span>
  );
}
