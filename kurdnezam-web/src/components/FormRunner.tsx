"use client";

import { useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AlertCircle, Check, Loader2, Lock, Paperclip, Upload, X } from "lucide-react";
import { ApiError, submitForm, type FormFileInput } from "@/lib/api";
import type { FormField, FormItem } from "@/data/content";

/**
 * Draws whatever fields an administrator gave a form, sends it, and shows the form's own thank-you
 * message. Used by the form page and, unchanged, at the bottom of a news article.
 *
 * Every limit here is also enforced by the server — this copy exists so a visitor learns about a
 * 20 MB file before spending their upload on it, not after.
 */

const MAX_BYTES_PER_FILE = 5 * 1024 * 1024;
const MAX_FILES_PER_FIELD = 3;
const MAX_BYTES_TOTAL = 15 * 1024 * 1024;

/** Content type → extension, same short list the server accepts. */
const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
};

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.docx";
const ALLOWED_LABEL = "PDF، JPG، PNG یا DOCX";

/** Megabytes in Persian digits — a lone Latin "5" in a Persian sentence reads as a typo. */
const mb = (bytes: number) => (bytes / (1024 * 1024)).toLocaleString("fa-IR");

const GENERIC_ERROR = "ارسال فرم با خطا مواجه شد؛ لطفاً دوباره تلاش کنید.";
const DEFAULT_SUCCESS = "اطلاعات شما با موفقیت ثبت شد. با تشکر.";

/** Persian-digit size of one chosen file, e.g. «۲٫۴ مگابایت». */
function formatSize(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  if (megabytes >= 1) {
    return `${megabytes.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت`;
  }
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("fa-IR")} کیلوبایت`;
}

function generalMessage(err: unknown): string {
  if (!(err instanceof ApiError)) return GENERIC_ERROR;
  if (err.status === 0) return "ارتباط با سرور برقرار نشد؛ اتصال اینترنت خود را بررسی کنید.";
  if (err.status === 404) return "این فرم دیگر در دسترس نیست.";
  if (err.status === 429) return "تعداد ارسال‌ها زیاد بود؛ چند دقیقه بعد دوباره تلاش کنید.";
  if (err.status === 413) return "حجم فایل‌ها بیش از حد مجاز است.";
  if (err.status === 400) return err.problem?.detail ?? "اطلاعات واردشده معتبر نیست.";
  return GENERIC_ERROR;
}

// `text-base` on mobile keeps controls at 16px so iOS Safari does not auto-zoom on focus;
// `md:text-sm` restores the denser desktop sizing. Same rule as the rest of the site.
//
// The focus ring is deliberate: the site's other inputs only tint their 1px border on focus, which
// a keyboard user can easily miss. On a form that asks for a national id and a licence scan, where
// you are is worth being obvious about.
const inputClass = (invalid: boolean) =>
  `mt-2 w-full rounded-xl border bg-paper px-4 py-3 text-base transition-colors outline-none focus-visible:border-copper focus-visible:ring-2 focus-visible:ring-copper/40 disabled:cursor-not-allowed disabled:opacity-60 md:text-sm ${
    invalid ? "border-red-400" : "border-line"
  }`;

/**
 * Wraps one field. A text field is a real <label htmlFor>; a file field cannot be, because its
 * control is a <button> and a <label> only points at labelable elements. That one renders a
 * plain wrapper, and the button borrows the same words through aria-labelledby.
 */
function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: ReactNode;
}) {
  return htmlFor ? (
    <label htmlFor={htmlFor} className="block text-sm">
      {children}
    </label>
  ) : (
    <div className="block text-sm">{children}</div>
  );
}

export interface FormRunnerProps {
  form: FormItem;
  /** `h2` on the form page, `h3` inside an article — so the page keeps one heading order. */
  headingLevel?: 2 | 3;
  /** The form page already shows the title above; an article needs it here. */
  showTitle?: boolean;
}

export function FormRunner({ form, headingLevel = 2, showTitle = false }: FormRunnerProps) {
  const fields = useMemo(
    () => [...(form.fields ?? [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [form.fields],
  );

  const [texts, setTexts] = useState<Record<number, string>>({});
  const [files, setFiles] = useState<Record<number, File[]>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<number, string>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  // Clearing a file <input> needs the element itself; React state cannot do it.
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  const closed = !form.isOpen;
  const disabled = closed || submitting || sent;
  const Heading = headingLevel === 3 ? "h3" : "h2";

  const clearError = (fieldId: number) =>
    setFieldErrors((prev) => {
      if (prev[fieldId] === undefined) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });

  const setText = (fieldId: number, value: string) => {
    setTexts((prev) => ({ ...prev, [fieldId]: value }));
    clearError(fieldId);
  };

  const addFiles = (field: FormField, picked: FileList | null) => {
    if (!picked || picked.length === 0) return;

    const incoming = Array.from(picked);
    const current = files[field.id] ?? [];
    const merged = field.allowMultiple ? [...current, ...incoming] : incoming.slice(0, 1);

    // Say what is wrong immediately rather than letting them press send and wait.
    const tooBig = merged.find((f) => f.size > MAX_BYTES_PER_FILE);
    const wrongType = merged.find((f) => !ALLOWED_TYPES[f.type]);

    if (wrongType) {
      setFieldErrors((prev) => ({
        ...prev,
        [field.id]: `نوع فایل «${wrongType.name}» مجاز نیست (${ALLOWED_LABEL}).`,
      }));
    } else if (tooBig) {
      setFieldErrors((prev) => ({
        ...prev,
        [field.id]: `فایل «${tooBig.name}» بزرگ‌تر از ${mb(MAX_BYTES_PER_FILE)} مگابایت است.`,
      }));
    } else if (merged.length > MAX_FILES_PER_FIELD) {
      setFieldErrors((prev) => ({
        ...prev,
        [field.id]: `حداکثر ${MAX_FILES_PER_FIELD.toLocaleString("fa-IR")} فایل.`,
      }));
    } else {
      clearError(field.id);
      setFiles((prev) => ({ ...prev, [field.id]: merged }));
    }

    // Always reset the input, so choosing the same file again still fires onChange.
    const input = fileInputs.current[field.id];
    if (input) input.value = "";
  };

  const removeFile = (fieldId: number, index: number) => {
    setFiles((prev) => {
      const next = [...(prev[fieldId] ?? [])];
      next.splice(index, 1);
      return { ...prev, [fieldId]: next };
    });
    clearError(fieldId);
  };

  /** The same rules the server applies, so the common mistakes never cost a round trip. */
  function validate(): Record<number, string> {
    const errors: Record<number, string> = {};

    for (const field of fields) {
      if (field.kind === "text") {
        const text = (texts[field.id] ?? "").trim();
        if (field.isRequired && text.length === 0) errors[field.id] = "این فیلد الزامی است.";
        else if (field.maxLength && text.length > field.maxLength) {
          errors[field.id] = `حداکثر ${field.maxLength.toLocaleString("fa-IR")} نویسه.`;
        }
        continue;
      }

      const chosen = files[field.id] ?? [];
      if (field.isRequired && chosen.length === 0) errors[field.id] = "بارگذاری فایل الزامی است.";
    }

    return errors;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled) return;

    const errors = validate();
    const total = Object.values(files).flat().reduce((sum, f) => sum + f.size, 0);

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      setGeneralError(null);
      return;
    }
    if (total > MAX_BYTES_TOTAL) {
      setGeneralError(`مجموع فایل‌ها بیش از ${mb(MAX_BYTES_TOTAL)} مگابایت است.`);
      return;
    }

    setSubmitting(true);
    setGeneralError(null);

    const answers = fields
      .filter((f) => f.kind === "text")
      .map((f) => ({ fieldId: f.id, text: (texts[f.id] ?? "").trim() }));

    const uploads: FormFileInput[] = Object.entries(files).flatMap(([fieldId, list]) =>
      list.map((file) => ({ fieldId: Number(fieldId), file })),
    );

    try {
      await submitForm(form.id, answers, uploads);
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.isValidation) {
        // The server keys per-field messages as `field_{id}`; anything else is a banner.
        const mapped: Record<number, string> = {};
        const orphans: string[] = [];

        for (const [key, messages] of Object.entries(err.errors)) {
          const match = /^field_(\d+)$/i.exec(key);
          if (match) mapped[Number(match[1])] = messages[0];
          else orphans.push(...messages);
        }

        setFieldErrors(mapped);
        setGeneralError(
          orphans[0] ??
            (Object.keys(mapped).length > 0 ? null : "اطلاعات واردشده معتبر نیست."),
        );
      } else {
        setGeneralError(generalMessage(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div
        role="status"
        className="rounded-3xl border border-line bg-white p-8 text-center shadow-card"
      >
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-copper-soft">
          <Check className="size-7 text-copper-dark" aria-hidden />
        </span>
        <p className="mt-4 text-lg font-semibold">{form.successMessage?.trim() || DEFAULT_SUCCESS}</p>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <p className="rounded-3xl border border-line bg-paper px-5 py-4 text-sm text-steel">
        این فرم هنوز فیلدی ندارد.
      </p>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="rounded-3xl border border-line bg-white p-6 shadow-card sm:p-8"
    >
      {showTitle ? <Heading className="font-display text-2xl sm:text-3xl">{form.title}</Heading> : null}
      {showTitle && form.note ? <p className="mt-2 text-sm text-steel">{form.note}</p> : null}

      {/*
        Both lines were on the page this component replaced, and both were worth keeping. The star
        needs explaining, and a form that asks for a national id and a licence scan should say what
        happens to them — that is the moment a visitor decides whether to fill it in.
      */}
      <p className={`text-sm text-ink/70 ${showTitle ? "mt-4" : ""}`}>
        {fields.some((f) => f.isRequired) ? (
          <>
            فیلدهای ستاره‌دار (<span className="text-copper">*</span>) الزامی هستند.{" "}
          </>
        ) : null}
        اطلاعات شما نزد سازمان محرمانه می‌ماند.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2">
        {fields.map((field) => {
          const invalid = Boolean(fieldErrors[field.id]);
          const errorId = `form-${form.id}-error-${field.id}`;
          const inputId = `form-${form.id}-field-${field.id}`;
          const describedBy = [invalid ? errorId : null, field.help ? `${inputId}-help` : null]
            .filter(Boolean)
            .join(" ");

          return (
            <div
              key={field.id}
              // A file field gets the full width: its chosen-files list needs the room.
              className={field.kind === "file" ? "sm:col-span-2" : ""}
            >
              {/*
                A <label> can only point at a labelable control, and a file field's real control is
                now a <button>. So a text field keeps its <label htmlFor>, while a file field uses a
                plain wrapper and hands the same words to the button through aria-labelledby.
              */}
              <FieldLabel htmlFor={field.kind === "text" ? inputId : undefined}>
                <span id={`${inputId}-name`} className="font-medium">
                  {field.label}
                  {field.isRequired ? <span className="text-copper"> *</span> : null}
                </span>

                {field.kind === "text" ? (
                  <input
                    id={inputId}
                    name={`field_${field.id}`}
                    value={texts[field.id] ?? ""}
                    maxLength={field.maxLength ?? undefined}
                    disabled={disabled}
                    required={field.isRequired}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy || undefined}
                    onChange={(e) => setText(field.id, e.target.value)}
                    className={inputClass(invalid)}
                  />
                ) : (
                  <>
                    {/*
                      The native control is driven by a real button instead of being shown. Left as
                      it comes, a file input paints the browser's own English chrome — "Choose File",
                      "No file chosen" — in the middle of a Persian right-to-left form. The input
                      stays in the DOM (clipped, not display:none, so it still works) and the button
                      carries the accessible name.
                    */}
                    <input
                      id={inputId}
                      ref={(el) => {
                        fileInputs.current[field.id] = el;
                      }}
                      type="file"
                      accept={ACCEPT}
                      multiple={field.allowMultiple}
                      tabIndex={-1}
                      aria-hidden="true"
                      disabled={disabled}
                      onChange={(e) => addFiles(field, e.target.files)}
                      className="sr-only"
                    />

                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => fileInputs.current[field.id]?.click()}
                      aria-labelledby={`${inputId}-name`}
                      // No aria-invalid: a button does not carry it. The red border shows the
                      // problem, and aria-describedby points at the message, which is role=alert.
                      aria-describedby={describedBy || undefined}
                      className={`mt-2 flex w-full items-center gap-3 rounded-xl border border-dashed bg-paper px-4 py-3 text-start text-sm transition-colors outline-none hover:border-copper focus-visible:border-copper focus-visible:ring-2 focus-visible:ring-copper/40 disabled:cursor-not-allowed disabled:opacity-60 ${
                        invalid ? "border-red-400" : "border-line"
                      }`}
                    >
                      <Upload className="size-4 shrink-0 text-copper" aria-hidden />
                      <span className="font-medium text-copper-dark">
                        {(files[field.id] ?? []).length > 0
                          ? field.allowMultiple
                            ? "افزودن فایل دیگر"
                            : "تغییر فایل"
                          : field.allowMultiple
                            ? "انتخاب فایل‌ها"
                            : "انتخاب فایل"}
                      </span>
                      <span className="ms-auto text-xs text-steel">
                        {(files[field.id] ?? []).length > 0
                          ? `${(files[field.id] ?? []).length.toLocaleString("fa-IR")} فایل`
                          : "فایلی انتخاب نشده"}
                      </span>
                    </button>

                    {(files[field.id] ?? []).length > 0 ? (
                      <ul className="mt-2 space-y-1.5">
                        {(files[field.id] ?? []).map((file, index) => (
                          <li
                            key={`${file.name}-${file.size}-${index}`}
                            className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2 text-xs"
                          >
                            <Paperclip className="size-3.5 shrink-0 text-copper" aria-hidden />
                            <span className="min-w-0 flex-1 truncate">{file.name}</span>
                            <span className="shrink-0 text-steel">{formatSize(file.size)}</span>
                            <button
                              type="button"
                              onClick={() => removeFile(field.id, index)}
                              disabled={disabled}
                              // 44px tap target without changing how the icon looks.
                              className="relative shrink-0 rounded p-1 text-steel transition-colors hover:text-red-600 before:absolute before:-inset-2.5 before:content-['']"
                              aria-label={`حذف ${file.name}`}
                            >
                              <X className="size-3.5" aria-hidden />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </>
                )}
              </FieldLabel>

              {field.help ? (
                <span id={`${inputId}-help`} className="mt-1.5 block text-xs text-ink/70">
                  {field.help}
                </span>
              ) : null}
              {field.kind === "file" && !field.help ? (
                <span id={`${inputId}-help`} className="mt-1.5 block text-xs text-ink/70">
                  {ALLOWED_LABEL} — حداکثر {mb(MAX_BYTES_PER_FILE)} مگابایت
                  {field.allowMultiple ? `، تا ${MAX_FILES_PER_FIELD.toLocaleString("fa-IR")} فایل` : ""}
                </span>
              ) : null}
              {invalid ? (
                <span id={errorId} role="alert" className="mt-1.5 block text-xs text-red-600">
                  {fieldErrors[field.id]}
                </span>
              ) : null}
            </div>
          );
        })}
      </div>

      {generalError ? (
        <p
          role="alert"
          className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700"
        >
          <AlertCircle className="mt-1 size-4 shrink-0" aria-hidden />
          <span>{generalError}</span>
        </p>
      ) : null}

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
          disabled={submitting}
          className="mt-6 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-copper px-8 py-3 font-semibold text-white transition-colors hover:bg-copper-dark disabled:opacity-60"
        >
          {submitting ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          {submitting ? "در حال ارسال…" : "ثبت و ارسال"}
        </button>
      )}
    </form>
  );
}

export default FormRunner;
