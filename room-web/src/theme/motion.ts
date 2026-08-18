import { useReducedMotion, type MotionProps, type Transition, type Variants } from "framer-motion";

type Bezier = [number, number, number, number];

/**
 * The app's motion rhythm, in seconds for framer-motion.
 *
 * These are the same numbers as `--m-fast` / `--m-base` / `--m-enter` and
 * `--ease` in global.css. CSS transitions and JS animations run at one speed
 * because they read one scale; change it here and there, or not at all.
 *
 * Rules the rest of the app follows:
 *   - entrances rise `rise` px and fade in
 *   - exits run at ~60% of the enter duration, so leaving feels responsive
 *   - only `transform` and `opacity` animate — never width/height/top/left
 *   - one moving thing per view
 */
export const MOTION: {
  fast: number;
  base: number;
  enter: number;
  ease: Bezier;
  easeIn: Bezier;
  stagger: number;
  rise: number;
} = {
  fast: 0.16,
  base: 0.24,
  enter: 0.32,
  ease: [0.2, 0.8, 0.2, 1],
  easeIn: [0.4, 0, 1, 1],
  stagger: 0.04,
  rise: 8,
};

export const enterTransition: Transition = { duration: MOTION.enter, ease: MOTION.ease };
export const exitTransition: Transition = { duration: MOTION.enter * 0.6, ease: MOTION.easeIn };

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: MOTION.rise },
  show: { opacity: 1, y: 0, transition: enterTransition },
};

export const listContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: MOTION.stagger } },
};

/**
 * Props for a element that fades and rises in once, on mount.
 *
 * Under "reduce motion" it returns `initial: false`, which tells framer-motion to
 * paint the element in its final state and skip the animation entirely. That is
 * different from a zero-length animation: there is no transform to leave behind.
 */
export function useEnter(delay = 0): MotionProps {
  const reduced = useReducedMotion();
  if (reduced) return { initial: false };
  return {
    initial: { opacity: 0, y: MOTION.rise },
    animate: { opacity: 1, y: 0 },
    transition: { ...enterTransition, delay },
  };
}

/**
 * Props for a list whose items arrive one after another.
 *
 * Spread `container` on the wrapper and `item` on each child; the wrapper drives
 * the timing, so the children need no index and no delay of their own.
 */
export function useListMotion(): { container: MotionProps; item: MotionProps } {
  const reduced = useReducedMotion();
  if (reduced) return { container: { initial: false }, item: { initial: false } };
  return {
    container: { initial: "hidden", animate: "show", variants: listContainer },
    item: { variants: fadeUp },
  };
}

/** Press feedback for a card or button that is one whole tap target. */
export function usePressable(): MotionProps {
  const reduced = useReducedMotion();
  if (reduced) return {};
  return {
    whileTap: { scale: 0.985 },
    transition: { duration: MOTION.fast, ease: MOTION.ease },
  };
}
