"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlertCircle, Building, Check, Landmark, Loader2, MapPin, Users } from "lucide-react";
import { ApiError, sendContactMessage } from "@/lib/api";
import type { ContactChannel, ContactSection, OrgPage as OrgPageDto } from "@/data/content";
import {
  CHANNEL_LABELS,
  ChannelIcon,
  SiteIcon,
  channelHref,
  externalHref,
  isLtrChannel,
} from "@/lib/siteIcons";
import { useI18n } from "@/lib/i18n";
import { childrenOf, findOrgPage, orgPageTitle } from "@/lib/orgPages";
import { useContent } from "@/lib/store";
import { Breadcrumb, PersonCard, Reveal, SectionHeading } from "@/components/ui";

/* ── contact page ──────────────────────────────────────── */

/** DOM field names — identical to the API payload keys. */
const CONTACT_FIELDS = ["name", "phone", "subject", "message", "sectionId"] as const;
type ContactField = (typeof CONTACT_FIELDS)[number];
type ContactErrors = Partial<Record<ContactField, string>>;

const EMPTY_CONTACT: Record<ContactField, string> = {
  name: "",
  phone: "",
  subject: "",
  message: "",
  sectionId: "",
};

const CONTACT_GENERIC_ERROR =
  "ارسال پیام با خطا مواجه شد؛ لطفاً دوباره تلاش کنید.";

function contactGeneralMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return CONTACT_GENERIC_ERROR;
  if (err.status === 0)
    return "ارتباط با سرور برقرار نشد؛ اتصال اینترنت خود را بررسی کنید.";
  if (err.status === 400)
    return err.problem?.detail ?? "اطلاعات واردشده معتبر نیست.";
  return CONTACT_GENERIC_ERROR;
}

/** Split an ApiError into per-input messages plus a banner message. */
function readContactErrors(err: unknown): {
  fields: ContactErrors;
  general: string | null;
} {
  const fields: ContactErrors = {};

  if (err instanceof ApiError && err.isValidation) {
    for (const field of CONTACT_FIELDS) {
      const message = err.fieldError(field);
      if (message) fields[field] = message;
    }
    const known = new Set<string>(CONTACT_FIELDS);
    const orphans = Object.entries(err.errors)
      .filter(([key]) => !known.has(key.toLowerCase()))
      .flatMap(([, messages]) => messages);

    const general =
      orphans[0] ??
      (Object.keys(fields).length > 0
        ? null
        : "اطلاعات واردشده معتبر نیست؛ لطفاً ورودی‌ها را بررسی کنید.");

    return { fields, general };
  }

  return { fields, general: contactGeneralMessage(err) };
}

// `text-base` on mobile keeps controls at 16px so iOS Safari does not
// auto-zoom on focus; `md:text-sm` restores the denser desktop sizing.
const contactInputClass = (invalid: boolean) =>
  `mt-2 w-full rounded-xl border bg-paper px-4 py-3 text-base outline-none transition-colors focus:border-copper disabled:cursor-not-allowed disabled:opacity-60 md:text-sm ${
    invalid ? "border-red-400" : "border-line"
  }`;

const contactTextareaClass = (invalid: boolean) =>
  `mt-2 w-full resize-y rounded-xl border bg-paper px-4 py-3 text-base outline-none transition-colors focus:border-copper disabled:cursor-not-allowed disabled:opacity-60 md:text-sm ${
    invalid ? "border-red-400" : "border-line"
  }`;

function ContactFieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} role="alert" className="mt-1.5 block text-xs text-red-600">
      {message}
    </span>
  );
}

/* ── one row inside a contact block ────────────────────── */

function ChannelRow({ channel }: { channel: ContactChannel }) {
  const href = channelHref(channel.kind, channel.value);
  const ltr = isLtrChannel(channel.kind);

  const value = (
    <span dir={ltr ? "ltr" : undefined} className={ltr ? "inline-block" : undefined}>
      {channel.value}
    </span>
  );

  return (
    <li className="flex items-start gap-3">
      <ChannelIcon kind={channel.kind} className="mt-1 size-4 shrink-0 text-copper" />
      <div className="min-w-0 text-sm leading-7">
        {/* The kind is announced to a screen reader but not repeated on screen — the icon and the
            value already say what it is, and «تلفن ثابت: ۰۸۷…» on every row is noise. */}
        <span className="sr-only">{CHANNEL_LABELS[channel.kind]}: </span>
        {href ? (
          <a
            href={href}
            {...(channel.kind === "telegram" ||
            channel.kind === "instagram" ||
            channel.kind === "website"
              ? { target: "_blank", rel: "noreferrer" }
              : {})}
            className="break-words text-ink underline-offset-4 transition-colors hover:text-copper hover:underline"
          >
            {value}
          </a>
        ) : (
          <span className="break-words text-steel">{value}</span>
        )}
        {channel.label ? (
          <span className="me-2 text-xs text-mist"> — {channel.label}</span>
        ) : null}
      </div>
    </li>
  );
}

function ContactSectionCard({ section }: { section: ContactSection }) {
  const channels = [...section.channels].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
  );

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-card">
      <div className="flex gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-ink text-gold">
          <SiteIcon name={section.icon} fallback={Building} className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="font-bold">{section.title}</h2>
          {section.description ? (
            <p className="mt-0.5 text-xs leading-6 text-mist">{section.description}</p>
          ) : null}
        </div>
      </div>
      {channels.length ? (
        <ul className="mt-4 space-y-2.5 border-t border-line pt-4">
          {channels.map((c) => (
            <ChannelRow key={c.id} channel={c} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The blueprint panel under the contact blocks. A link only when a map URL has been set. */
function MapPanel({ label, href }: { label: string; href: string }) {
  if (!label) return null;
  // Same rule the contact rows use: a bare «neshan.org/…» must not resolve against our own origin.
  const url = externalHref(href);

  const caption = (
    <span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm">
      <MapPin className="size-4 shrink-0 text-gold" aria-hidden />
      {label}
    </span>
  );

  if (!url) {
    return <div className="blueprint grid h-56 place-items-center rounded-2xl text-mist">{caption}</div>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={`نمایش «${label}» روی نقشه`}
      className="blueprint grid h-56 place-items-center rounded-2xl text-mist transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-copper"
    >
      {caption}
    </a>
  );
}

function ContactPage() {
  const { content } = useContent();
  const s = content.settings;

  const page = content.orgPages.find((p) => p.slug === "tamas");
  const sections = [...content.contactSections]
    .filter((x) => x.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);

  /**
   * If every block has been switched off, fall back to the organisation-wide details rather than
   * showing a contact page with no way to make contact.
   */
  const fallback: ContactSection | null = sections.length
    ? null
    : {
        id: 0,
        title: "تماس با سازمان",
        description: null,
        icon: "building",
        sortOrder: 0,
        isActive: true,
        channels: [
          ...(s.address
            ? [{ id: -1, kind: "address" as const, label: null, value: s.address, sortOrder: 1 }]
            : []),
          ...s.phones.map((phone, i) => ({
            id: -(i + 2),
            kind: "phone" as const,
            label: null,
            value: phone,
            sortOrder: i + 2,
          })),
          ...(s.postalCode
            ? [
                {
                  id: -99,
                  kind: "postal" as const,
                  label: null,
                  value: s.postalCode,
                  sortOrder: 99,
                },
              ]
            : []),
        ],
      };

  const blocks = fallback ? [fallback] : sections;

  const [values, setValues] =
    useState<Record<ContactField, string>>(EMPTY_CONTACT);
  const [fieldErrors, setFieldErrors] = useState<ContactErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const setValue = (field: ContactField, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (prev[field] === undefined) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || sent) return;

    setSubmitting(true);
    setFieldErrors({});
    setGeneralError(null);

    try {
      await sendContactMessage({
        name: values.name.trim(),
        phone: values.phone.trim(),
        subject: values.subject.trim(),
        message: values.message.trim(),
        // "" means the visitor left it on «انتخاب کنید»; the API wants null, not 0.
        sectionId: values.sectionId ? Number(values.sectionId) : null,
      });
      setSent(true);
    } catch (err) {
      const { fields, general } = readContactErrors(err);
      setFieldErrors(fields);
      setGeneralError(general);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Breadcrumb items={[{ title: page?.title ?? "تماس با ما" }]} />
      <h1 className="font-display text-5xl">{page?.title ?? "تماس با ما"}</h1>
      {page?.intro ? (
        <p className="mt-3 max-w-2xl leading-8 text-steel">{page.intro}</p>
      ) : null}

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        {/* the contact blocks, in the order the panel gives them */}
        <Reveal>
          <div className="space-y-4">
            {blocks.map((section) => (
              <ContactSectionCard key={section.id} section={section} />
            ))}

            {/* Still a styled placeholder rather than an embedded map — but the caption is editable
                now, and it becomes a link once a map URL is set. */}
            <MapPanel label={s.mapLabel || s.address} href={s.mapUrl} />
          </div>
        </Reveal>

        {/* form */}
        <Reveal delay={0.1}>
          <form
            onSubmit={handleSubmit}
            className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8"
          >
            <h2 className="font-display text-3xl">ارسال پیام</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <label htmlFor="contact-name" className="block text-sm">
                <span className="font-medium">
                  نام و نام خانوادگی <span className="text-copper">*</span>
                </span>
                <input
                  required
                  id="contact-name"
                  name="name"
                  autoComplete="name"
                  value={values.name}
                  onChange={(e) => setValue("name", e.target.value)}
                  disabled={submitting || sent}
                  aria-invalid={fieldErrors.name ? true : undefined}
                  aria-describedby={
                    fieldErrors.name ? "contact-error-name" : undefined
                  }
                  className={contactInputClass(Boolean(fieldErrors.name))}
                />
                <ContactFieldError
                  id="contact-error-name"
                  message={fieldErrors.name}
                />
              </label>
              <label htmlFor="contact-phone" className="block text-sm">
                <span className="font-medium">
                  شماره تماس <span className="text-copper">*</span>
                </span>
                <input
                  required
                  id="contact-phone"
                  name="phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  dir="ltr"
                  value={values.phone}
                  onChange={(e) => setValue("phone", e.target.value)}
                  disabled={submitting || sent}
                  aria-invalid={fieldErrors.phone ? true : undefined}
                  aria-describedby={
                    fieldErrors.phone ? "contact-error-phone" : undefined
                  }
                  className={contactInputClass(Boolean(fieldErrors.phone))}
                />
                <ContactFieldError
                  id="contact-error-phone"
                  message={fieldErrors.phone}
                />
              </label>
              {/* Only offered when there is a real choice to make: with one block, or none, the
                  dropdown would be a control whose answer is already known. */}
              {sections.length > 1 && (
                <label htmlFor="contact-section" className="block text-sm sm:col-span-2">
                  <span className="font-medium">بخش مربوطه</span>
                  <select
                    id="contact-section"
                    name="sectionId"
                    value={values.sectionId}
                    onChange={(e) => setValue("sectionId", e.target.value)}
                    disabled={submitting || sent}
                    aria-invalid={fieldErrors.sectionId ? true : undefined}
                    aria-describedby={
                      fieldErrors.sectionId ? "contact-error-sectionId" : undefined
                    }
                    className={contactInputClass(Boolean(fieldErrors.sectionId))}
                  >
                    <option value="">انتخاب کنید (اختیاری)</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.title}
                      </option>
                    ))}
                  </select>
                  <ContactFieldError
                    id="contact-error-sectionId"
                    message={fieldErrors.sectionId}
                  />
                </label>
              )}
              <label htmlFor="contact-subject" className="block text-sm sm:col-span-2">
                <span className="font-medium">موضوع</span>
                <input
                  id="contact-subject"
                  name="subject"
                  value={values.subject}
                  onChange={(e) => setValue("subject", e.target.value)}
                  disabled={submitting || sent}
                  aria-invalid={fieldErrors.subject ? true : undefined}
                  aria-describedby={
                    fieldErrors.subject ? "contact-error-subject" : undefined
                  }
                  className={contactInputClass(Boolean(fieldErrors.subject))}
                />
                <ContactFieldError
                  id="contact-error-subject"
                  message={fieldErrors.subject}
                />
              </label>
              <label htmlFor="contact-message" className="block text-sm sm:col-span-2">
                <span className="font-medium">
                  متن پیام <span className="text-copper">*</span>
                </span>
                <textarea
                  required
                  id="contact-message"
                  name="message"
                  rows={5}
                  value={values.message}
                  onChange={(e) => setValue("message", e.target.value)}
                  disabled={submitting || sent}
                  aria-invalid={fieldErrors.message ? true : undefined}
                  aria-describedby={
                    fieldErrors.message ? "contact-error-message" : undefined
                  }
                  className={contactTextareaClass(Boolean(fieldErrors.message))}
                />
                <ContactFieldError
                  id="contact-error-message"
                  message={fieldErrors.message}
                />
              </label>
            </div>

            {generalError && (
              <p
                role="alert"
                className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
              >
                <AlertCircle className="mt-1 size-4 shrink-0" aria-hidden />
                <span>{generalError}</span>
              </p>
            )}

            <button
              type="submit"
              disabled={submitting || sent}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-copper px-8 py-3 font-semibold text-white transition-colors hover:bg-copper-dark disabled:opacity-60"
            >
              {submitting && (
                <Loader2 className="size-5 animate-spin" aria-hidden />
              )}
              {!submitting && sent && <Check className="size-5" aria-hidden />}
              {submitting
                ? "در حال ارسال…"
                : sent
                  ? "پیام شما ثبت شد"
                  : "ارسال پیام"}
            </button>
            {sent && (
              <p role="status" className="mt-3 text-sm text-steel">
                پیام شما دریافت شد؛ کارشناسان سازمان در اولین فرصت با شما تماس
                می‌گیرند.
              </p>
            )}
          </form>
        </Reveal>
      </div>
    </div>
  );
}

/* ── a hub's child cards ───────────────────────────────── */

/**
 * The cards are a page's child org pages — the same rows that build the header dropdown, through the
 * same helper, so the two can never drift.
 *
 * Not limited to «ارکان سازمان»: the admin panel offers *any* top-level page as a parent and tells
 * the editor their page will appear as a card on it, so every hub renders its children. (Only ارکان
 * additionally gets a menu dropdown — that is one fixed slot in the site's navigation, not a
 * property of being a hub.)
 */
function HubCards({ cards }: { cards: OrgPageDto[] }) {
  const { t, lang } = useI18n();
  if (cards.length === 0) return null;

  return (
    <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card, i) => (
        <Reveal key={card.id} delay={i * 0.07}>
          <Link
            href={`/p/${card.slug}`}
            className="group block h-full rounded-2xl border border-line bg-white p-6 shadow-card transition-shadow hover:shadow-lift"
          >
            <span className="grid size-12 place-items-center rounded-xl bg-ink text-gold transition-colors group-hover:bg-copper group-hover:text-white">
              <SiteIcon name={card.icon} fallback={Landmark} className="size-6" />
            </span>
            <h2 className="mt-4 font-bold text-lg break-words">{orgPageTitle(card, lang, t)}</h2>
            {/* Guarded: «متن کارت» is optional in the panel, and an unconditional <p> leaves a stray
                gap under the title for a card that has none. */}
            {card.summary ? (
              <p className="mt-2 break-words text-sm leading-7 text-steel">{card.summary}</p>
            ) : null}
          </Link>
        </Reveal>
      ))}
    </div>
  );
}

/** Shown when a slug does not resolve — see the note in OrgPage about telling the two cases apart. */
function OrgPageMessage({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-24 text-center">
      <h1 className="font-display text-3xl leading-snug sm:text-4xl">{title}</h1>
      {body ? <p className="mt-3 leading-8 text-steel">{body}</p> : null}
      <Link
        href="/"
        className="mt-6 inline-block rounded-xl bg-copper px-6 py-3 font-semibold text-white"
      >
        بازگشت به خانه
      </Link>
    </div>
  );
}

/* ── generic people page ───────────────────────────────── */
export default function OrgPage() {
  const { slug } = useParams<{ slug: string }>();
  const { content } = useContent();
  const { t, lang } = useI18n();

  // The contact page is a genuinely different layout; every other slug — including «ارکان سازمان» —
  // is this one page, which shows an intro, then its child cards, then its people, rendering only
  // the parts it actually has.
  if (slug === "tamas") return <ContactPage />;

  const page = findOrgPage(content.orgPages, slug);

  if (!page) {
    // «صفحه یافت نشد» would be a lie when we simply have no content: layout.tsx falls back to
    // EMPTY_CONTENT on any fetch failure, and /p/modir certainly exists.
    return content.orgPages.length === 0 ? (
      <OrgPageMessage
        title="اطلاعات این صفحه در دسترس نیست"
        body="ارتباط با سرویس محتوا برقرار نشد؛ لطفاً چند لحظه بعد دوباره تلاش کنید."
      />
    ) : (
      <OrgPageMessage title="صفحه یافت نشد" />
    );
  }

  const cards = childrenOf(content.orgPages, slug);
  // A page needs no group — «ارکان سازمان» has none, and an admin can create a prose-only page.
  const people = page.group ? content.people.filter((p) => p.group === page.group) : [];
  // Same rule as the menu and the cards, so a Kurdish reader who clicked «دەستەی بەڕێوەبردن» does
  // not land on a page headed «هیئت مدیره». In Persian this is exactly `page.title`.
  const title = orgPageTitle(page, lang, t);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Breadcrumb items={[{ title }]} />
      {/* text-5xl has line-height 1 in Tailwind, so a long admin-entered title collides with its
          own second line at 375px. */}
      <h1 className="font-display text-3xl leading-snug break-words sm:text-4xl lg:text-5xl">
        {title}
      </h1>
      {page.intro ? (
        <p className="mt-3 max-w-3xl break-words leading-8 text-steel">{page.intro}</p>
      ) : null}

      <HubCards cards={cards} />

      {people.length > 0 ? (
        <div className="mt-10">
          <SectionHeading icon={Users} title="معرفی اعضا و مسئولین" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {people.map((person, i) => (
              <PersonCard key={person.id} person={person} index={i} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
