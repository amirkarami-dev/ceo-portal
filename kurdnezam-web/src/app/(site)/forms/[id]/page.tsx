"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { AlertCircle, CalendarDays, Check, Loader2, Lock } from "lucide-react";
import { ApiError, imageUrl, submitForm } from "@/lib/api";
import { useContent } from "@/lib/store";
import { Breadcrumb, Reveal } from "@/components/ui";

/* ── field mapping: DOM name → API payload key ─────────── */
const FIELD_MAP = {
  name: "fullName",
  nid: "nationalId",
  membership: "membershipNo",
  mobile: "mobile",
  notes: "notes",
} as const;

type FieldName = keyof typeof FIELD_MAP;
type FieldErrors = Partial<Record<FieldName, string>>;

const EMPTY_VALUES: Record<FieldName, string> = {
  name: "",
  nid: "",
  membership: "",
  mobile: "",
  notes: "",
};

/** Lower-cased API keys we know how to attach to an input. */
const KNOWN_API_FIELDS = new Set<string>(
  Object.values(FIELD_MAP).map((key) => key.toLowerCase())
);

const GENERIC_ERROR = "ارسال فرم با خطا مواجه شد؛ لطفاً دوباره تلاش کنید.";

function generalMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return GENERIC_ERROR;
  if (err.status === 0)
    return "ارتباط با سرور برقرار نشد؛ اتصال اینترنت خود را بررسی کنید.";
  if (err.status === 404) return "این فرم دیگر در دسترس نیست.";
  if (err.status === 400)
    return (
      err.problem?.detail ??
      "امکان ثبت این فرم وجود ندارد؛ ممکن است مهلت آن به پایان رسیده باشد."
    );
  return GENERIC_ERROR;
}

/** Split an ApiError into per-input messages plus a banner message. */
function readErrors(err: unknown): { fields: FieldErrors; general: string | null } {
  const fields: FieldErrors = {};

  if (err instanceof ApiError && err.isValidation) {
    for (const field of Object.keys(FIELD_MAP) as FieldName[]) {
      const message = err.fieldError(FIELD_MAP[field]);
      if (message) fields[field] = message;
    }
    // validation messages that belong to no input still have to be shown
    const orphans = Object.entries(err.errors)
      .filter(([key]) => !KNOWN_API_FIELDS.has(key.toLowerCase()))
      .flatMap(([, messages]) => messages);

    const general =
      orphans[0] ??
      (Object.keys(fields).length > 0
        ? null
        : "اطلاعات واردشده معتبر نیست؛ لطفاً ورودی‌ها را بررسی کنید.");

    return { fields, general };
  }

  return { fields, general: generalMessage(err) };
}

// `text-base` on mobile keeps controls at 16px so iOS Safari does not
// auto-zoom on focus; `md:text-sm` restores the denser desktop sizing.
const inputClass = (invalid: boolean) =>
  `mt-2 w-full rounded-xl border bg-paper px-4 py-3 text-base outline-none transition-colors focus:border-copper disabled:cursor-not-allowed disabled:opacity-60 md:text-sm ${
    invalid ? "border-red-400" : "border-line"
  }`;

const textareaClass = (invalid: boolean) =>
  `mt-2 w-full resize-y rounded-xl border bg-paper px-4 py-3 text-base outline-none transition-colors focus:border-copper disabled:cursor-not-allowed disabled:opacity-60 md:text-sm ${
    invalid ? "border-red-400" : "border-line"
  }`;

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <span id={id} role="alert" className="mt-1.5 block text-xs text-red-600">
      {message}
    </span>
  );
}

export default function FormPage() {
  const { id } = useParams<{ id: string }>();
  const { content } = useContent();
  const form = content.forms.find((f) => String(f.id) === id);

  const [values, setValues] = useState<Record<FieldName, string>>(EMPTY_VALUES);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const setValue = (field: FieldName, value: string) => {
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
    if (!form || !form.isOpen || submitting || sent) return;

    setSubmitting(true);
    setFieldErrors({});
    setGeneralError(null);

    try {
      const notes = values.notes.trim();
      await submitForm(form.id, {
        fullName: values.name.trim(),
        nationalId: values.nid.trim(),
        membershipNo: values.membership.trim(),
        mobile: values.mobile.trim(),
        notes: notes === "" ? undefined : notes,
      });
      setSent(true);
    } catch (err) {
      const { fields, general } = readErrors(err);
      setFieldErrors(fields);
      setGeneralError(general);
    } finally {
      setSubmitting(false);
    }
  }

  if (!form) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="font-display text-4xl">فرم یافت نشد</h1>
        <Link
          href="/"
          className="mt-6 inline-block rounded-xl bg-copper px-6 py-3 font-semibold text-white"
        >
          بازگشت به خانه
        </Link>
      </div>
    );
  }

  const closed = !form.isOpen;
  const inputsDisabled = closed || submitting || sent;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <Breadcrumb
        items={[{ title: "فرم‌ها و نظرسنجی‌ها" }, { title: form.title }]}
      />
      <h1 className="font-display text-4xl leading-snug sm:text-5xl">
        {form.title}
      </h1>
      <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-steel">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4 text-copper" aria-hidden />
          مهلت تکمیل: {form.deadline}
        </span>
        <span className="rounded-full bg-copper-soft px-3 py-1 text-xs text-copper-dark">
          {form.note}
        </span>
      </div>

      <div className="relative mt-8 aspect-[16/7] overflow-hidden rounded-3xl border border-line shadow-card">
        <Image
          src={imageUrl(form.image)}
          alt=""
          fill
          sizes="(max-width: 896px) 100vw, 896px"
          className="object-cover"
        />
      </div>

      <Reveal>
        <form
          onSubmit={handleSubmit}
          noValidate={closed}
          className="mt-8 rounded-3xl border border-line bg-white p-6 shadow-card sm:p-10"
        >
          <h2 className="font-display text-3xl">فرم ثبت‌نام</h2>
          <p className="mt-2 text-sm text-steel">
            فیلدهای ستاره‌دار الزامی هستند. اطلاعات شما نزد سازمان محرمانه
            می‌ماند.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label htmlFor="form-name" className="block text-sm">
              <span className="font-medium">
                نام و نام خانوادگی <span className="text-copper">*</span>
              </span>
              <input
                required
                id="form-name"
                name="name"
                autoComplete="name"
                value={values.name}
                onChange={(e) => setValue("name", e.target.value)}
                disabled={inputsDisabled}
                aria-invalid={fieldErrors.name ? true : undefined}
                aria-describedby={fieldErrors.name ? "form-error-name" : undefined}
                className={inputClass(Boolean(fieldErrors.name))}
              />
              <FieldError id="form-error-name" message={fieldErrors.name} />
            </label>
            <label htmlFor="form-nid" className="block text-sm">
              <span className="font-medium">
                کد ملی <span className="text-copper">*</span>
              </span>
              <input
                required
                id="form-nid"
                name="nid"
                inputMode="numeric"
                autoComplete="off"
                dir="ltr"
                value={values.nid}
                onChange={(e) => setValue("nid", e.target.value)}
                disabled={inputsDisabled}
                aria-invalid={fieldErrors.nid ? true : undefined}
                aria-describedby={fieldErrors.nid ? "form-error-nid" : undefined}
                className={inputClass(Boolean(fieldErrors.nid))}
              />
              <FieldError id="form-error-nid" message={fieldErrors.nid} />
            </label>
            <label htmlFor="form-membership" className="block text-sm">
              <span className="font-medium">
                شماره عضویت <span className="text-copper">*</span>
              </span>
              <input
                required
                id="form-membership"
                name="membership"
                inputMode="numeric"
                dir="ltr"
                value={values.membership}
                onChange={(e) => setValue("membership", e.target.value)}
                disabled={inputsDisabled}
                aria-invalid={fieldErrors.membership ? true : undefined}
                aria-describedby={
                  fieldErrors.membership ? "form-error-membership" : undefined
                }
                className={inputClass(Boolean(fieldErrors.membership))}
              />
              <FieldError
                id="form-error-membership"
                message={fieldErrors.membership}
              />
            </label>
            <label htmlFor="form-mobile" className="block text-sm">
              <span className="font-medium">
                شماره همراه <span className="text-copper">*</span>
              </span>
              <input
                required
                id="form-mobile"
                name="mobile"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                dir="ltr"
                value={values.mobile}
                onChange={(e) => setValue("mobile", e.target.value)}
                disabled={inputsDisabled}
                aria-invalid={fieldErrors.mobile ? true : undefined}
                aria-describedby={
                  fieldErrors.mobile ? "form-error-mobile" : undefined
                }
                className={inputClass(Boolean(fieldErrors.mobile))}
              />
              <FieldError id="form-error-mobile" message={fieldErrors.mobile} />
            </label>
            <label htmlFor="form-notes" className="block text-sm sm:col-span-2">
              <span className="font-medium">توضیحات</span>
              <textarea
                id="form-notes"
                name="notes"
                rows={4}
                value={values.notes}
                onChange={(e) => setValue("notes", e.target.value)}
                disabled={inputsDisabled}
                aria-invalid={fieldErrors.notes ? true : undefined}
                aria-describedby={
                  fieldErrors.notes ? "form-error-notes" : undefined
                }
                className={textareaClass(Boolean(fieldErrors.notes))}
              />
              <FieldError id="form-error-notes" message={fieldErrors.notes} />
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

          {closed ? (
            <p
              role="status"
              className="mt-6 flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-steel"
            >
              <Lock className="size-4 shrink-0 text-copper" aria-hidden />
              این فرم بسته شده است
            </p>
          ) : (
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
                  ? "ثبت‌نام شما انجام شد"
                  : "ثبت و ارسال"}
            </button>
          )}
          {sent && (
            <p role="status" className="mt-3 text-sm text-steel">
              ثبت‌نام شما با موفقیت انجام شد؛ نتیجه از طریق پیامک اطلاع‌رسانی
              می‌شود.
            </p>
          )}
        </form>
      </Reveal>
    </div>
  );
}
