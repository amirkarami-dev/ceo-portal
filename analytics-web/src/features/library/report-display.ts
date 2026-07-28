import type { SessionUser } from "@/auth/useAuth";

const SUBJECT_ID = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;

export function reportOwnerLabel(
  ownerName: string | undefined,
  user: SessionUser | null,
  fallback: string,
) {
  if (!ownerName || SUBJECT_ID.test(ownerName)) {
    return user && ownerName === user.id ? user.name : fallback;
  }

  return ownerName;
}