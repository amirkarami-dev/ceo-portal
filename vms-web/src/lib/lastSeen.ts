/**
 * «آخرین اتصال» — how long ago the scheduled sweep last reached a camera.
 *
 * Shared by the wall and the admin table so the two never disagree about what "recently" means.
 *
 * <p><b>Null is not "offline".</b> It means the sweep has never reached this camera — a camera added
 * five minutes ago, or a sweep that is not running. Rendering that as «بی‌ارتباط» would accuse a
 * working camera of being broken, which is the failure this whole feature exists to avoid.</p>
 */
export type Freshness = "fresh" | "stale" | "old" | "never";

export interface LastSeen {
  label: string;
  freshness: Freshness;
}

export function lastSeenInfo(value: string | null | undefined, now: number = Date.now()): LastSeen {
  if (!value) return { label: "هنوز بررسی نشده", freshness: "never" };

  const minutes = Math.round((now - new Date(value).getTime()) / 60_000);

  // The sweep runs every five minutes, so anything inside ten is a camera that answered on the last
  // pass or the one before. Calling that "stale" would light the panel up over ordinary jitter.
  if (minutes < 10) return { label: "چند دقیقه پیش", freshness: "fresh" };
  if (minutes < 60) return { label: `${minutes} دقیقه پیش`, freshness: "stale" };

  const hours = Math.round(minutes / 60);
  if (hours < 24) return { label: `${hours} ساعت پیش`, freshness: "old" };

  return { label: `${Math.round(hours / 24)} روز پیش`, freshness: "old" };
}

export const lastSeenLabel = (value: string | null | undefined): string => lastSeenInfo(value).label;
