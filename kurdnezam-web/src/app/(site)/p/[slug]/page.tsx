"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AlertCircle,
  Check,
  Gavel,
  Landmark,
  Loader2,
  Mail,
  MapPin,
  Phone,
  ScrollText,
  Users,
  UsersRound,
  Vote,
} from "lucide-react";
import { ApiError, sendContactMessage } from "@/lib/api";
import { useContent } from "@/lib/store";
import { Breadcrumb, PersonCard, Reveal, SectionHeading } from "@/components/ui";

/* ── contact page ──────────────────────────────────────── */

/** DOM field names — identical to the API payload keys. */
const CONTACT_FIELDS = ["name", "phone", "subject", "message"] as const;
type ContactField = (typeof CONTACT_FIELDS)[number];
type ContactErrors = Partial<Record<ContactField, string>>;

const EMPTY_CONTACT: Record<ContactField, string> = {
  name: "",
  phone: "",
  subject: "",
  message: "",
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

function ContactPage() {
  const { content } = useContent();
  const s = content.settings;

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
      <Breadcrumb items={[{ title: "تماس با ما" }]} />
      <h1 className="font-display text-5xl">تماس با ما</h1>
      <p className="mt-3 max-w-2xl leading-8 text-steel">
        برای طرح پرسش، پیشنهاد یا شکایت می‌توانید از راه‌های زیر با سازمان در
        ارتباط باشید؛ کارشناسان ما در ساعات اداری پاسخگوی شما هستند.
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        {/* info */}
        <Reveal>
          <div className="space-y-4">
            {[
              { icon: MapPin, title: "نشانی", value: s.address },
              {
                icon: Phone,
                title: "تلفن تماس",
                value: s.phones.join(" — "),
                dir: "ltr" as const,
              },
              { icon: Mail, title: "کدپستی", value: s.postalCode },
            ].map((row) => (
              <div
                key={row.title}
                className="flex gap-4 rounded-2xl border border-line bg-white p-5 shadow-card"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-ink text-gold">
                  <row.icon className="size-5" aria-hidden />
                </span>
                <div>
                  <h2 className="font-bold">{row.title}</h2>
                  <p className="mt-1 text-sm leading-7 text-steel" dir={row.dir}>
                    {row.value}
                  </p>
                </div>
              </div>
            ))}
            {/* map placeholder */}
            <div className="blueprint grid h-56 place-items-center rounded-2xl text-mist">
              <span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm">
                <MapPin className="size-4 text-gold" aria-hidden />
                سنندج، میدان کوهنورد — جنب بانک مسکن
              </span>
            </div>
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

/* ── arkan overview ────────────────────────────────────── */
const arkanCards = [
  {
    icon: Vote,
    title: "مجمع عمومی",
    href: "/p/majmaeomumi",
    text: "عالی‌ترین رکن سازمان، متشکل از کلیه اعضای دارای پروانه اشتغال.",
  },
  {
    icon: UsersRound,
    title: "هیئت مدیره",
    href: "/p/modir",
    text: "اداره امور سازمان و اجرای مصوبات مجمع عمومی.",
  },
  {
    icon: Landmark,
    title: "هیئت رئیسه",
    href: "/p/hayatraise",
    text: "مدیریت اجرایی و راهبری روزانه سازمان.",
  },
  {
    icon: Gavel,
    title: "شورای انتظامی",
    href: "/p/shorayeentezami",
    text: "مرجع رسیدگی به تخلفات حرفه‌ای اعضای سازمان.",
  },
  {
    icon: ScrollText,
    title: "بازرسین",
    href: "/p/bazrsin",
    text: "نظارت بر عملکرد مالی و اجرایی سازمان.",
  },
];

function ArkanPage() {
  const { content } = useContent();
  const intro = content.orgPages.find((p) => p.slug === "arkan")?.intro ?? "";

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Breadcrumb items={[{ title: "ارکان سازمان" }]} />
      <h1 className="font-display text-5xl">ارکان سازمان</h1>
      <p className="mt-3 max-w-3xl leading-8 text-steel">{intro}</p>
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {arkanCards.map((card, i) => (
          <Reveal key={card.title} delay={i * 0.07}>
            <Link
              href={card.href}
              className="group block h-full rounded-2xl border border-line bg-white p-6 shadow-card transition-shadow hover:shadow-lift"
            >
              <span className="grid size-12 place-items-center rounded-xl bg-ink text-gold transition-colors group-hover:bg-copper group-hover:text-white">
                <card.icon className="size-6" aria-hidden />
              </span>
              <h2 className="mt-4 font-bold text-lg">{card.title}</h2>
              <p className="mt-2 text-sm leading-7 text-steel">{card.text}</p>
            </Link>
          </Reveal>
        ))}
      </div>
    </div>
  );
}

/* ── generic people page ───────────────────────────────── */
export default function OrgPage() {
  const { slug } = useParams<{ slug: string }>();
  const { content } = useContent();

  if (slug === "tamas") return <ContactPage />;
  if (slug === "arkan") return <ArkanPage />;

  const page = content.orgPages.find((p) => p.slug === slug);
  if (!page) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-4xl">صفحه یافت نشد</h1>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-copper px-6 py-3 font-semibold text-white"
        >
          بازگشت به خانه
        </Link>
      </div>
    );
  }

  // `arkan` is the only page without a group, and it never reaches here.
  const { group } = page;
  const people = group
    ? content.people.filter((p) => p.group === group)
    : [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <Breadcrumb items={[{ title: page.title }]} />
      <h1 className="font-display text-5xl">{page.title}</h1>
      <p className="mt-3 max-w-3xl leading-8 text-steel">{page.intro}</p>
      <div className="mt-10">
        <SectionHeading icon={Users} title="معرفی اعضا و مسئولین" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {people.map((person, i) => (
            <PersonCard key={person.id} person={person} index={i} />
          ))}
        </div>
      </div>
    </div>
  );
}
