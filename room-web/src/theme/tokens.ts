import { theme, type ThemeConfig } from "antd";

export type ThemeMode = "light" | "dark";

/**
 * The palette.
 *
 * These are the estate's own brand colours — the same set the other apps in the
 * launcher use — with meanings assigned for *this* app. room-web is a meetings
 * tool, not a dashboard, and it sits beside ten sibling apps, so it borrows the
 * family's colours rather than inventing an identity of its own.
 *
 * `onair` and `danger` are two different reds on purpose. In a video product red
 * means "on air" everywhere; if the same red also meant "failed", then "you are
 * live" and "this broke" would be the same signal. Both are always paired with an
 * icon and a word, so colour never carries the meaning by itself.
 */
export const PALETTE = {
  brand: "#326BFC",
  onair: "#FD411E",
  soon: "#FCBB21",
  ok: "#24AF7E",
  danger: "#E5484D",
} as const;

/** The two grounds. Near-black with a blue bias, not neutral grey. */
const GROUND = { dark: "#070B14", light: "#F5F7FB" } as const;
/** What cards, the header and the sider sit on. */
const SURFACE = { dark: "#0F1626", light: "#FFFFFF" } as const;

/**
 * AntD theme config for the given mode (light/dark), shared across the app.
 *
 * @param reducedMotion Turns AntD's own animation off at the source.
 *   Not a nicety: AntD parks a drawer off-screen with a transform and only removes it when the
 *   motion ENDS. global.css crushes every duration to 0.001ms under `prefers-reduced-motion`, the
 *   end event is missed, and the transform stays — the participants/chat drawer in a meeting would
 *   never appear. With `motion: false` there is no transform to strand, so the panel simply shows,
 *   which is what "reduce motion" should mean.
 */
export function buildTheme(mode: ThemeMode, reducedMotion = false): ThemeConfig {
  const isDark = mode === "dark";
  return {
    algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      motion: !reducedMotion,
      colorPrimary: PALETTE.brand,
      colorSuccess: PALETTE.ok,
      colorWarning: PALETTE.soon,
      colorError: PALETTE.danger,
      colorInfo: PALETTE.brand,
      borderRadius: 12,
      // AntD's large control is 40px, which is under the 44px a finger needs. Large
      // is what the guest-facing flows use — join, sign in, enter the meeting — so
      // it is raised. The default 32px stays for dense admin tables on a desktop.
      controlHeightLG: 44,
      fontFamily:
        "'Vazirmatn', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      colorBgLayout: isDark ? GROUND.dark : GROUND.light,
      // Without these, AntD's dark algorithm paints every card, table and modal
      // #141414 — a neutral grey sitting on a blue-biased ground, which reads as
      // two different dark themes on one screen.
      colorBgContainer: isDark ? SURFACE.dark : SURFACE.light,
      colorBgElevated: isDark ? "#16203A" : SURFACE.light,
      // AntD's secondary text is 45% of black or white, which measures 3.36:1 on a
      // white card and 4.50:1 on a dark one — the first fails AA outright and the
      // second passes with nothing to spare. Every subtitle, card meta row and form
      // hint in this app uses it, so it comes from the palette instead: 5.72:1 on
      // white, 7.57:1 on the dark surface. `colorTextDescription` is what AntD uses
      // for a Form.Item's `extra`, and it does not follow the other one.
      colorTextSecondary: isDark ? "#9AA8C8" : "#5A6684",
      colorTextDescription: isDark ? "#9AA8C8" : "#5A6684",
    },
    components: {
      Layout: {
        headerBg: isDark ? SURFACE.dark : SURFACE.light,
        siderBg: isDark ? SURFACE.dark : SURFACE.light,
        // Transparent, so the body's ambient wash shows through instead of being
        // painted over by a flat panel. body carries the base colour underneath.
        bodyBg: "transparent",
        headerHeight: 64,
        headerPadding: "0 16px",
      },
      Card: { borderRadiusLG: 16 },
      Menu: { itemBorderRadius: 10 },
      Table: { borderRadiusLG: 14 },
      // AntD ships a coloured drop-shadow under primary/danger buttons that dates
      // the whole UI. Depth here comes from the elevation scale, not from buttons.
      Button: { fontWeight: 600, primaryShadow: "none", dangerShadow: "none" },
    },
  };
}

/** Where a meeting sits in its own life. Drives the time rail and the status dot. */
export type MeetingPhase = "upcoming" | "soon" | "live" | "ended";

/**
 * Colour for a meeting phase, in the given theme.
 *
 * Light mode does not simply reuse `PALETTE`: raw `soon` (#FCBB21) and `onair`
 * (#FD411E) fall below 4.5:1 on a white card, so light mode gets darkened
 * versions of the same hues. Dark mode gets brightened ones. The hue — gold,
 * red, blue, grey — is what carries the meaning, and it survives both.
 */
export function phaseColor(mode: ThemeMode, phase: MeetingPhase): string {
  const isDark = mode === "dark";
  switch (phase) {
    case "upcoming":
      return isDark ? "#7CA5FF" : "#2C5FE0";
    case "soon":
      return isDark ? "#FFC94A" : "#8A6100";
    case "live":
      return isDark ? "#FF7A5C" : "#C4300F";
    case "ended":
      return isDark ? "#7C89A8" : "#5C6880";
  }
}

/** The same colour at a lower opacity — a tinted chip behind text of that colour. */
export function withAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
