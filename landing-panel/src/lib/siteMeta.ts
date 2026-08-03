import type { ContactChannelKind } from "@/api/types";

/**
 * Persian labels for the contact-row kinds. The keys are the API's contract — they are validated by
 * `KurdnezamContactChannelKinds` and by a CHECK constraint — so only the labels live here.
 */
export const CHANNEL_KIND_LABELS: Record<ContactChannelKind, string> = {
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

/** A hint under the value field, so the admin knows what shape the site expects. */
export const CHANNEL_KIND_PLACEHOLDERS: Record<ContactChannelKind, string> = {
  phone: "۰۸۷۳۳۵۶۴۸۷۶",
  mobile: "۰۹۱۲۳۴۵۶۷۸۹",
  fax: "۰۸۷۳۳۵۶۴۸۷۰",
  email: "info@kurdnezam.ir",
  address: "سنندج - میدان کوهنورد - …",
  postal: "۶۶۱۹۷۷۵۴۱۱",
  hours: "شنبه تا چهارشنبه، ۸ تا ۱۵",
  telegram: "https://t.me/kurdnezam",
  instagram: "https://instagram.com/kurdnezam",
  website: "https://kurdnezam.ir",
};

/** Kinds whose value the site turns into a clickable link. Shown as a hint in the form. */
export const LINKED_CHANNEL_KINDS: ContactChannelKind[] = [
  "phone",
  "mobile",
  // The site dials a fax like any other number (siteIcons.channelHref groups fax with phone/mobile),
  // so the hint has to say so — these two lists disagreeing is how an admin gets surprised.
  "fax",
  "email",
  "telegram",
  "instagram",
  "website",
];

/**
 * The icons the public site can draw, grouped so the picker reads as a menu rather than a list of
 * twenty-four English words.
 *
 * This is the same fixed set as `KurdnezamContactIcons.All` on the server, and it is fixed for a
 * reason: lucide cannot resolve an arbitrary runtime string without bundling its whole library.
 * Adding one means editing three places — this file, the server's list, and the site's registry.
 *
 * There is no live preview here on purpose. `landing-panel` does not carry lucide, and a preview
 * drawn with a *different* icon set would be a picture of something the visitor never sees. The
 * Persian label describes the real icon instead.
 */
export interface IconOption {
  value: string;
  label: string;
}

export interface IconGroup {
  label: string;
  options: IconOption[];
}

export const ICON_GROUPS: IconGroup[] = [
  {
    label: "عمومی",
    options: [
      { value: "building", label: "ساختمان" },
      { value: "landmark", label: "بنای رسمی" },
      { value: "briefcase", label: "کیف اداری" },
      { value: "users", label: "گروه افراد" },
      { value: "user-round", label: "یک نفر" },
      { value: "headset", label: "پشتیبانی (هدست)" },
      { value: "info", label: "اطلاعات" },
    ],
  },
  {
    label: "راه‌های تماس",
    options: [
      { value: "phone", label: "گوشی تلفن" },
      { value: "mail", label: "پاکت نامه" },
      { value: "map-pin", label: "نشانگر نقشه" },
      { value: "clock", label: "ساعت" },
      { value: "printer", label: "دورنگار" },
      { value: "globe", label: "کرهٔ زمین" },
    ],
  },
  {
    label: "ارکان سازمان",
    options: [
      { value: "vote", label: "رأی‌گیری" },
      { value: "users-round", label: "هیئت" },
      { value: "gavel", label: "چکش داوری" },
      { value: "scroll-text", label: "طومار" },
      { value: "shield-check", label: "سپر تأیید" },
      { value: "scale", label: "ترازوی عدالت" },
    ],
  },
  {
    label: "حوزه‌های کاری",
    options: [
      { value: "hard-hat", label: "کلاه ایمنی" },
      { value: "zap", label: "برق" },
      { value: "flame", label: "گاز" },
      { value: "ruler", label: "نقشه‌برداری" },
      { value: "file-text", label: "سند" },
      { value: "wrench", label: "آچار" },
    ],
  },
];

const ICON_LABELS = new Map(
  ICON_GROUPS.flatMap((g) => g.options).map((o) => [o.value, o.label] as const),
);

/** Falls back to the raw key, so a value from an older build still shows something meaningful. */
export function iconLabel(icon?: string | null): string {
  if (!icon) return "—";
  return ICON_LABELS.get(icon) ?? icon;
}
