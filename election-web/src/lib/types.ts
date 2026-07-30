// Mirrors the API DTOs in src/Application/Elections/*.cs. The backend is authoritative — if a field
// moves here, move it there too.
//
// ENUMS ARE NUMBERS. The Web host registers no JsonStringEnumConverter, so System.Text.Json sends
// ElectionStatus.Draft as 0, not "Draft". Same convention as walfare-web/src/api/walfareApi.ts.
// Typing these as string unions compiles fine and then fails silently at runtime — every comparison
// is just false, so a draft would show no publish button and nobody would know why.

export const ElectionStatus = {
  Draft: 0,
  Published: 1,
  Cancelled: 2,
} as const;
export type ElectionStatus = (typeof ElectionStatus)[keyof typeof ElectionStatus];

/** Derived on the server from status + clock; never stored. */
export const ElectionPhase = {
  Draft: 0,
  Cancelled: 1,
  NotYetOpen: 2,
  Open: 3,
  Closed: 4,
  ResultsAvailable: 5,
} as const;
export type ElectionPhase = (typeof ElectionPhase)[keyof typeof ElectionPhase];

export const EligibilityMode = {
  AllMembers: 0,
  ByReshte: 1,
} as const;
export type EligibilityMode = (typeof EligibilityMode)[keyof typeof EligibilityMode];

/** The org's seven real Reshte codes. Authoritative, from the data dictionary. */
export const RESHTE_OPTIONS = [
  { value: "1", label: "معماری" },
  { value: "2", label: "شهرسازی" },
  { value: "3", label: "عمران" },
  { value: "4", label: "مکانیک" },
  { value: "5", label: "برق" },
  { value: "6", label: "نقشه‌برداری" },
  { value: "7", label: "ترافیک" },
] as const;

/**
 * NOTE: this list is a convenience for the admin picker only. The backend stores whatever code it is
 * given as an opaque string and never validates against a list, so adding an eighth discipline is a
 * one-line change here — not a migration. The four names in the client's original document
 * (سازه، ژئوتکنیک، زه‌کشی، سازه نگهبان) are deliberately absent: they are صلاحیت, not رشته, and no
 * column in the org DB carries them.
 */
export interface EligibleReshte {
  code: string;
  label: string | null;
}

export interface CandidateInput {
  fullName: string;
  description: string | null;
  reshteCode: string | null;
  educationLevel: string | null;
  image: string | null;
  sortOrder: number;
}

export interface ElectionInput {
  title: string;
  description: string | null;
  eligibilityMode: EligibilityMode;
  /** Jalali, as typed: 1405/05/01. */
  dateJalali: string;
  /** "HH:mm:ss" — TimeOnly on the wire. */
  startTime: string;
  endTime: string;
  maxSelections: number;
  eligibleReshtes: EligibleReshte[];
  candidates: CandidateInput[];
}

export interface ElectionListItem {
  id: number;
  title: string;
  dateJalali: string;
  startTime: string;
  endTime: string;
  status: ElectionStatus;
  phase: ElectionPhase;
  eligibilityMode: EligibilityMode;
  maxSelections: number;
  candidateCount: number;
  eligibilitySummary: string;
  /** A count only. The API deliberately cannot tell you WHO voted. */
  ballotCount: number;
}

export interface ElectionCandidate {
  id: number;
  fullName: string;
  description: string | null;
  reshteCode: string | null;
  educationLevel: string | null;
  image: string | null;
  sortOrder: number;
}

export interface ElectionDetail {
  id: number;
  title: string;
  description: string | null;
  dateJalali: string;
  startTime: string;
  endTime: string;
  status: ElectionStatus;
  phase: ElectionPhase;
  eligibilityMode: EligibilityMode;
  maxSelections: number;
  eligibleReshtes: EligibleReshte[];
  candidates: ElectionCandidate[];
  eligibilitySummary: string;
  ballotCount: number;
  /** False once voting opened or a ballot exists — the server's freeze rule. */
  isEditable: boolean;
}

// ── voter side ───────────────────────────────────────────────────────────────

/** A candidate as a voter sees them. Deliberately carries NO vote count. */
export interface BallotCandidate {
  id: number;
  fullName: string;
  description: string | null;
  /** Already the Persian name («مکانیک»); the server resolves the code. */
  reshteLabelOrCode: string | null;
  educationLevel: string | null;
  image: string | null;
}

export interface Ballot {
  id: number;
  title: string;
  description: string | null;
  dateJalali: string;
  startTime: string;
  endTime: string;
  /** ISO instants. Used only to know when to re-ask the server — `phase` stays the authority. */
  opensAtUtc: string;
  closesAtUtc: string;
  maxSelections: number;
  phase: ElectionPhase;
  eligibilitySummary: string;
  /** True only when this person may cast right now. The server's verdict, never re-derived here. */
  canVote: boolean;
  /** Why not, in Persian. Empty when canVote is true. */
  reason: string;
  alreadyVoted: boolean;
  candidates: BallotCandidate[];
}

export interface CastVoteResult {
  accepted: boolean;
  message: string;
}

export interface TallyOutcome {
  ballotsCounted: number;
  votesCounted: number;
  wasRecount: boolean;
  resultDigest: string;
}

export interface CandidateResult {
  candidateId: number;
  fullName: string;
  reshteCode: string | null;
  educationLevel: string | null;
  image: string | null;
  votes: number;
  /** Ties share a rank and the next rank skips: 1, 2, 2, 4. */
  rank: number;
  isTie: boolean;
}

export interface ElectionResult {
  electionId: number;
  title: string;
  dateJalali: string;
  /** How many people voted. There is no per-discipline breakdown — see the design §13. */
  ballotsCast: number;
  /** Total selections; differs from ballotsCast when maxSelections > 1. */
  votesCast: number;
  maxSelections: number;
  eligibilitySummary: string;
  talliedAt: string;
  resultDigest: string;
  ballotsPurged: boolean;
  candidates: CandidateResult[];
}

export const PHASE_LABELS: Record<ElectionPhase, string> = {
  [ElectionPhase.Draft]: "پیش‌نویس",
  [ElectionPhase.Cancelled]: "لغوشده",
  [ElectionPhase.NotYetOpen]: "در انتظار شروع",
  [ElectionPhase.Open]: "در جریان",
  [ElectionPhase.Closed]: "پایان‌یافته",
  [ElectionPhase.ResultsAvailable]: "نتیجه اعلام شد",
};

export const PHASE_COLOURS: Record<ElectionPhase, string> = {
  [ElectionPhase.Draft]: "default",
  [ElectionPhase.Cancelled]: "red",
  [ElectionPhase.NotYetOpen]: "blue",
  [ElectionPhase.Open]: "green",
  [ElectionPhase.Closed]: "orange",
  [ElectionPhase.ResultsAvailable]: "purple",
};

/** The picker gives "08:00"; TimeOnly on the wire wants "08:00:00". */
export function toWireTime(v: string): string {
  const t = v.trim();
  return /^\d{1,2}:\d{2}$/.test(t) ? `${t.padStart(5, "0")}:00` : t;
}

/** The API gives "08:00:00"; the picker and the UI want "08:00". */
export function fromWireTime(v: string): string {
  return v.slice(0, 5);
}
