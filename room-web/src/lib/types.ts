// Mirrors the API DTOs in src/Application/Rooms/*.cs. The backend is authoritative — if a field moves
// here, move it there too.
//
// ENUMS ARE NUMBERS. The Web host registers no JsonStringEnumConverter, so System.Text.Json sends
// RoomType.Presentation as 1, not "Presentation". Same convention as election-web and walfare-web.
// Typing these as string unions compiles fine and then fails silently at runtime — every comparison
// is just false, so a presentation would render as a meeting and nobody would know why.

export const RoomType = {
  /** Everyone equal: all attendees may use camera, microphone and screen share. */
  Meeting: 0,
  /** One-to-many. Only the presenter publishes; everyone else watches and may chat. */
  Presentation: 1,
} as const;
export type RoomType = (typeof RoomType)[keyof typeof RoomType];

export const RoomJoinMode = {
  /** Invite list only. No link. `Meeting` only. */
  InviteOnly: 0,
  /** By link, but the visitor must sign in with کد ملی + کد پیامکی. */
  Private: 1,
  /** By link, with nothing but a typed name. `Presentation` only. */
  Public: 2,
} as const;
export type RoomJoinMode = (typeof RoomJoinMode)[keyof typeof RoomJoinMode];

export const TYPE_LABELS: Record<RoomType, string> = {
  [RoomType.Meeting]: "جلسه",
  [RoomType.Presentation]: "ارائه",
};

export const JOIN_MODE_LABELS: Record<RoomJoinMode, string> = {
  [RoomJoinMode.InviteOnly]: "فقط دعوت‌شدگان",
  [RoomJoinMode.Private]: "با لینک و ورود با کد ملی",
  [RoomJoinMode.Public]: "با لینک، بدون نیاز به ورود",
};

export const JOIN_MODE_COLOURS: Record<RoomJoinMode, string> = {
  [RoomJoinMode.InviteOnly]: "blue",
  [RoomJoinMode.Private]: "geekblue",
  // Amber, not green. A public link is the one setting an admin should look at twice before saving.
  [RoomJoinMode.Public]: "orange",
};

/**
 * The four combinations the server refuses, mirrored so the form can refuse them first.
 *
 * These are CHECK constraints on the database, not just validation — every one is a security rule.
 * Duplicating them here does not weaken that: the server is still the authority and answers with the
 * same Persian sentence. This only stops the admin filling in a whole form to be told at save.
 *
 * @returns the Persian reason, or null when the shape is fine.
 */
export function validateShape(
  type: RoomType,
  joinMode: RoomJoinMode,
  presenterNationalCode: string | undefined,
): string | null {
  if (joinMode === RoomJoinMode.Public && type !== RoomType.Presentation) {
    return "لینک عمومی فقط برای «ارائه» امکان‌پذیر است. برای جلسه، دعوت‌نامه یا ورود با کد ملی را انتخاب کنید.";
  }
  if (joinMode === RoomJoinMode.InviteOnly && type !== RoomType.Meeting) {
    return "«فقط دعوت‌شدگان» فقط برای جلسه امکان‌پذیر است. برای ارائه، نوع ورود عمومی یا با کد ملی را انتخاب کنید.";
  }
  if (type === RoomType.Presentation && !presenterNationalCode?.trim()) {
    return "برای ارائه، انتخاب ارائه‌دهنده الزامی است.";
  }
  return null;
}

/** Which join modes are offered for a type. Keeps the picker from showing a choice that cannot save. */
export function allowedJoinModes(type: RoomType): RoomJoinMode[] {
  return type === RoomType.Presentation
    ? [RoomJoinMode.Private, RoomJoinMode.Public]
    : [RoomJoinMode.InviteOnly, RoomJoinMode.Private];
}

// ── admin ────────────────────────────────────────────────────────────────────

export interface RoomInput {
  name: string;
  description: string | null;
  type: RoomType;
  joinMode: RoomJoinMode;
  /** The presenter's کد ملی. Required for a presentation; the server resolves the name. */
  presenterUserId: string | null;
  /** Jalali, as typed: 1405/05/01. */
  dateJalali: string;
  /** "HH:mm:ss" — TimeOnly on the wire. */
  startTime: string;
  earlyJoinMinutes: number;
  durationMinutes: number | null;
  maxParticipants: number;
}

export interface RoomListItem {
  id: number;
  name: string;
  description: string | null;
  type: RoomType;
  joinMode: RoomJoinMode;
  dateJalali: string;
  startTime: string;
  startsAtUtc: string;
  opensAtUtc: string;
  durationMinutes: number | null;
  maxParticipants: number;
  presenterName: string | null;
  isActive: boolean;
  /** How many people are inside right now. 0 when the media server is unreachable. */
  liveCount: number;
  inviteCount: number;
  /** The whole URL, ready to copy. Null for an invite-only meeting. Administrator-only. */
  joinUrl: string | null;
}

export interface RoomInvite {
  userId: string;
  userName: string | null;
}

export interface RoomDetail {
  id: number;
  name: string;
  description: string | null;
  type: RoomType;
  joinMode: RoomJoinMode;
  dateJalali: string;
  startTime: string;
  startsAtUtc: string;
  earlyJoinMinutes: number;
  durationMinutes: number | null;
  maxParticipants: number;
  presenterUserId: string | null;
  presenterName: string | null;
  isActive: boolean;
  slug: string;
  joinUrl: string | null;
  liveCount: number;
  invites: RoomInvite[];
}

/** What the کد ملی lookup answers, so a picker can show a name before saving. */
export interface RoomPerson {
  nationalCode: string;
  fullName: string;
}

// ── attendee ─────────────────────────────────────────────────────────────────

export interface MyRoom {
  id: number;
  name: string;
  description: string | null;
  type: RoomType;
  joinMode: RoomJoinMode;
  presenterName: string | null;
  startsAtUtc: string;
  opensAtUtc: string;
  durationMinutes: number | null;
  liveCount: number;
  /** The server's verdict. Never re-derived here — a browser clock is not the authority. */
  canJoinNow: boolean;
  isPresenter: boolean;
}

// ── the link landing page ────────────────────────────────────────────────────

/**
 * What a stranger holding a link is shown, before they are let in.
 *
 * Carries no identifiers of any kind — no room id, no slug, no invite list. Whoever asks for this has
 * done nothing but hold a link, and may still be refused at the next step.
 */
export interface RoomLanding {
  name: string;
  description: string | null;
  type: RoomType;
  joinMode: RoomJoinMode;
  presenterName: string | null;
  startsAtUtc: string;
  /** Start time minus the early-join grace. What the countdown targets. */
  opensAtUtc: string;
  durationMinutes: number | null;
  /** The server's clock, so a device with the wrong time still counts down correctly. */
  serverNowUtc: string;
  canJoinNow: boolean;
  requiresSignIn: boolean;
  requiresName: boolean;
  /** Why not, in Persian. Empty when canJoinNow. */
  denyMessage: string;
}

/** Everything the browser needs to connect, once every gate has passed. */
export interface RoomJoinResult {
  roomId: number;
  roomName: string;
  type: RoomType;
  /** The signed media token. One room, one participant, and it expires. */
  token: string;
  wsUrl: string;
  identity: string;
  displayName: string;
  /** Whether camera, microphone and screen are allowed. Mirrors what the token already says. */
  canPublish: boolean;
  presenterName: string | null;
}

/** True when this identity came in through a link rather than a login. */
export function isGuest(identity: string): boolean {
  return identity.startsWith("guest-");
}

// ── chat ─────────────────────────────────────────────────────────────────────

export interface RoomMessage {
  id: number;
  senderId: string;
  senderName: string;
  /** Set by the server from the credential, never from the request body. */
  isGuest: boolean;
  text: string;
  sentAtUtc: string;
}

/**
 * What travels over the media server's data channel when somebody sends a line.
 *
 * The saved copy is the authority — this is only how the other clients hear about it without waiting
 * for a poll. `id` comes from the row the server just wrote, so a message that arrives both ways
 * de-duplicates on it.
 */
export interface ChatWireMessage {
  kind: "chat";
  id: number;
  senderId: string;
  senderName: string;
  isGuest: boolean;
  text: string;
  sentAtUtc: string;
}

// ── wire helpers ─────────────────────────────────────────────────────────────

/** The picker gives "08:00"; TimeOnly on the wire wants "08:00:00". */
export function toWireTime(v: string): string {
  const t = v.trim();
  return /^\d{1,2}:\d{2}$/.test(t) ? `${t.padStart(5, "0")}:00` : t;
}

/** The API gives "08:00:00"; the picker and the UI want "08:00". */
export function fromWireTime(v: string): string {
  return v.slice(0, 5);
}

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Persian digits in, ASCII out. The API compares کد ملی exactly, so «۵۵۵» must not reach it. */
export function toAsciiDigits(v: string): string {
  return v.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)));
}

export const fa = (n: number) => n.toLocaleString("fa-IR");
