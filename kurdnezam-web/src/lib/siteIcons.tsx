import {
  AtSign,
  Briefcase,
  Building,
  Clock,
  FileText,
  Flame,
  Gavel,
  Globe,
  HardHat,
  Headset,
  Info,
  Landmark,
  Mail,
  MapPin,
  Phone,
  Printer,
  Ruler,
  Scale,
  ScrollText,
  Send,
  ShieldCheck,
  Smartphone,
  UserRound,
  Users,
  UsersRound,
  Vote,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ContactChannelKind } from "@/data/content";

/**
 * The icons an editor may pick, keyed by the strings the admin panel stores.
 *
 * A fixed registry rather than a dynamic lookup, because `lucide-react` cannot resolve an arbitrary
 * runtime string without pulling its whole library into the bundle (5,978 exports). The same list
 * lives in `KurdnezamContactIcons` on the server and in `landing-panel/src/lib/siteMeta.ts`; adding
 * one means editing all three.
 */
const ICONS: Record<string, LucideIcon> = {
  // general
  building: Building,
  landmark: Landmark,
  briefcase: Briefcase,
  users: Users,
  "user-round": UserRound,
  headset: Headset,
  info: Info,
  // contact
  phone: Phone,
  mail: Mail,
  "map-pin": MapPin,
  clock: Clock,
  printer: Printer,
  globe: Globe,
  // organs
  vote: Vote,
  "users-round": UsersRound,
  gavel: Gavel,
  "scroll-text": ScrollText,
  "shield-check": ShieldCheck,
  scale: Scale,
  // work areas
  "hard-hat": HardHat,
  zap: Zap,
  flame: Flame,
  ruler: Ruler,
  "file-text": FileText,
  wrench: Wrench,
};

/**
 * The icon for a contact row. Driven by `kind`, not by an editor choice — the row already says what
 * it is, and letting someone put a printer next to an email address would only ever be a mistake.
 *
 * lucide dropped its brand icons, so Telegram and Instagram reuse the shapes the footer already
 * uses for them (`Send`, `AtSign`) rather than inventing a second convention.
 */
export const CHANNEL_ICONS: Record<ContactChannelKind, LucideIcon> = {
  phone: Phone,
  mobile: Smartphone,
  fax: Printer,
  email: Mail,
  address: MapPin,
  postal: Mail,
  hours: Clock,
  telegram: Send,
  instagram: AtSign,
  website: Globe,
};

/**
 * Renders the icon an editor picked.
 *
 * A component rather than a `getIcon()` helper on purpose: resolving to a component *inside* a
 * caller's render body reads to the React Compiler lint as creating a component during render
 * ("Cannot create components during render"), because it cannot tell a lookup from a factory.
 * Doing the lookup in here keeps that honest and keeps the call sites plain JSX.
 */
export function SiteIcon({
  name,
  fallback: Fallback = Info,
  className,
}: {
  name: string | null | undefined;
  fallback?: LucideIcon;
  className?: string;
}) {
  const Icon = (name && ICONS[name]) || Fallback;
  return <Icon className={className} aria-hidden />;
}

/** The icon for a contact row, chosen by its kind. */
export function ChannelIcon({
  kind,
  className,
}: {
  kind: ContactChannelKind;
  className?: string;
}) {
  const Icon = CHANNEL_ICONS[kind] ?? Info;
  return <Icon className={className} aria-hidden />;
}

/** Persian names, used for the accessible label on each row. */
export const CHANNEL_LABELS: Record<ContactChannelKind, string> = {
  phone: "تلفن ثابت",
  mobile: "تلفن همراه",
  fax: "دورنگار",
  email: "پست الکترونیک",
  address: "نشانی",
  postal: "کدپستی",
  hours: "ساعات کاری",
  telegram: "تلگرام",
  instagram: "اینستاگرام",
  website: "وبگاه",
};

/** Values that read as gibberish under RTL and must be forced left-to-right. */
const LTR_KINDS: ReadonlySet<ContactChannelKind> = new Set([
  "phone",
  "mobile",
  "fax",
  "email",
  "postal",
  "telegram",
  "instagram",
  "website",
]);

export function isLtrChannel(kind: ContactChannelKind): boolean {
  return LTR_KINDS.has(kind);
}

/**
 * The href a contact row becomes, or null when it is plain text.
 *
 * Phone numbers are stripped of everything but digits and a leading `+` — `tel:` ignores spaces and
 * dashes, but a stray Persian digit would make the link silently dead on a phone.
 */
export function channelHref(kind: ContactChannelKind, value: string): string | null {
  const v = value.trim();
  if (!v) return null;

  switch (kind) {
    case "phone":
    case "mobile":
    case "fax":
      return `tel:${toLatinDigits(v).replace(/[^\d+]/g, "")}`;
    case "email":
      return `mailto:${v}`;
    case "telegram":
    case "instagram":
    case "website":
      return /^https?:\/\//i.test(v) ? v : `https://${v}`;
    default:
      return null;
  }
}

/**
 * An admin-entered URL, made absolute. Without this, «neshan.org/@35.31,46.99» is resolved by the
 * browser *relative to kurdnezam.ir* and the link silently 404s.
 */
export function externalHref(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

/** ۰۹۱۲… → 0912…, so `tel:` gets something a dialler understands. */
function toLatinDigits(value: string): string {
  return value.replace(/[۰-۹٠-٩]/g, (d) => {
    const code = d.charCodeAt(0);
    const base = code >= 0x06f0 ? 0x06f0 : 0x0660; // Persian ۰ or Arabic ٠
    return String(code - base);
  });
}
