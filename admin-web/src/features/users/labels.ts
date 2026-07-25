/** Presentation helpers for the built-in roles. Unknown roles fall back to their raw key. */

export const ROLE_LABELS: Record<string, string> = {
  Administrator: "مدیر",
  User: "کاربر",
};

export function roleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

/** AntD Tag colour per role. */
export function roleColor(role: string): string {
  return role === "Administrator" ? "gold" : "blue";
}

/** True when two string sets are equal regardless of order (used to skip no-op role/service PUTs). */
export function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((v) => sa.has(v));
}
