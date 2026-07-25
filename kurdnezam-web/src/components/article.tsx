"use client";

import DOMPurify from "isomorphic-dompurify";
import { Download, FileSpreadsheet, FileText, FileType, ImageIcon, Paperclip } from "lucide-react";
import { imageUrl } from "@/lib/api";
import type { NewsAttachment } from "@/data/content";

/** True when the stored body is HTML from the editor rather than the older typed plain text. */
function looksLikeHtml(value: string): boolean {
  return /<\/?(p|div|br|h[1-6]|ul|ol|li|strong|em|u|s|a|blockquote)\b/i.test(value);
}

/**
 * Article body. Older items are plain text with blank-line paragraphs; newer ones are HTML from
 * the panel's editor. Render both, and sanitize the HTML — the panel is admin-only, but the body
 * still ends up as raw markup on a public page, so it does not go in unchecked.
 */
export function ArticleBody({ body, className = "" }: { body: string; className?: string }) {
  const text = body ?? "";

  if (!looksLikeHtml(text)) {
    return (
      <div className={className}>
        {text.split("\n\n").map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    );
  }

  const clean = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [
      "p", "br", "strong", "b", "em", "i", "u", "s", "a",
      "ul", "ol", "li", "h2", "h3", "h4", "blockquote", "code", "pre", "hr", "span",
    ],
    ALLOWED_ATTR: ["href", "target", "rel", "style", "dir"],
    // Only allow safe link schemes — blocks javascript: URLs.
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i,
  });

  return <div className={className} dangerouslySetInnerHTML={{ __html: clean }} />;
}

function iconFor(a: NewsAttachment) {
  const t = (a.contentType || "").toLowerCase();
  const ext = a.fileName.toLowerCase().split(".").pop() ?? "";
  if (t.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext))
    return <ImageIcon className="size-5 text-copper" aria-hidden />;
  if (t.includes("pdf") || ext === "pdf") return <FileText className="size-5 text-copper" aria-hidden />;
  if (t.includes("excel") || t.includes("spreadsheet") || ["xls", "xlsx"].includes(ext))
    return <FileSpreadsheet className="size-5 text-copper" aria-hidden />;
  return <FileType className="size-5 text-copper" aria-hidden />;
}

/** Persian-digit size, e.g. "۲٫۴ مگابایت". */
function formatSize(bytes: number): string {
  if (!bytes) return "";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toLocaleString("fa-IR", { maximumFractionDigits: 1 })} مگابایت`;
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("fa-IR")} کیلوبایت`;
}

/**
 * Downloadable files for an article. `?name=` makes the API send the original Persian file name:
 * these are served from the API origin, where the HTML `download` attribute is ignored.
 */
export function AttachmentList({ items }: { items?: NewsAttachment[] }) {
  if (!items || items.length === 0) return null;

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="flex items-center gap-2 font-bold text-ink">
        <Paperclip className="size-5 text-copper" aria-hidden />
        فایل‌های پیوست
        <span className="text-sm font-normal text-steel">({items.length.toLocaleString("fa-IR")})</span>
      </h2>

      <ul className="mt-4 grid gap-2">
        {items.map((a) => (
          <li key={a.id ?? a.url}>
            <a
              href={`${imageUrl(a.url)}?name=${encodeURIComponent(a.fileName)}`}
              target="_blank"
              rel="noreferrer"
              className="group flex items-center gap-3 rounded-xl border border-line bg-paper px-4 py-3 transition-colors hover:border-copper hover:bg-copper-soft"
            >
              {iconFor(a)}
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-ink">{a.fileName}</span>
                {a.sizeBytes ? (
                  <span className="block text-xs text-steel">{formatSize(a.sizeBytes)}</span>
                ) : null}
              </span>
              <Download
                className="size-5 shrink-0 text-steel transition-colors group-hover:text-copper"
                aria-hidden
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
