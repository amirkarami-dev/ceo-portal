"use client"

import { useLocale } from "next-intl"

export function Faq() {
  const locale = useLocale()
  const fa = locale === "fa"

  const items = [
    {
      q: fa ? "مبحث ۱۹ چیست؟" : "What is Section 19?",
      a: fa
        ? "مبحث ۱۹ مقررات ملی ساختمان مربوط به صرفه‌جویی در مصرف انرژی است و الزامات حرارتی پوسته و تأسیسات ساختمان را تعیین می‌کند."
        : "Section 19 of Iran's national building code covers energy conservation and defines thermal requirements for the envelope and building systems.",
    },
    {
      q: fa ? "آیا استفاده از پلتفرم رایگان است؟" : "Is the platform free to use?",
      a: fa
        ? "بله، استفاده از سامانه رایگان است و به همهٔ چک‌لیست‌ها و خروجی PDF فارسی دسترسی دارید."
        : "Yes, the platform is free to use, with full access to all checklists and Persian PDF export.",
    },
    {
      q: fa ? "گزارش خروجی چه فرمتی دارد؟" : "What format is the report?",
      a: fa
        ? "گزارش به‌صورت فایل PDF فارسی با چیدمان راست‌به‌چپ و قابل ارائه به مراجع رسمی تولید می‌شود."
        : "Reports are generated as Persian PDF files with RTL layout, ready to submit to authorities.",
    },
    {
      q: fa ? "چگونه وارد شوم؟" : "How do I log in?",
      a: fa
        ? "می‌توانید با شماره موبایل، حساب گوگل یا از طریق سامانه نظام مهندسی ساختمان وارد شوید."
        : "You can log in with your phone number, Google account, or via the engineering organization system.",
    },
    {
      q: fa ? "آیا پهنه اقلیمی به‌صورت خودکار تعیین می‌شود؟" : "Is the climate zone detected automatically?",
      a: fa
        ? "بله، با انتخاب موقعیت پروژه، پهنه اقلیمی مناسب از میان ۶ پهنه کشور پیشنهاد می‌شود."
        : "Yes, after selecting the project location, the appropriate zone among the 6 regions is suggested.",
    },
  ]

  return (
    <section id="faq" className="scroll-mt-20 bg-muted/40">
      <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 md:py-20">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {fa ? "سوالات متداول" : "Frequently asked questions"}
          </h2>
        </div>

        <div className="mt-10 space-y-3">
          {items.map((it) => (
            <details
              key={it.q}
              className="group rounded-2xl border border-border bg-card px-5 py-4 shadow-sm transition-colors open:border-primary/40"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-start text-base font-medium text-foreground [&::-webkit-details-marker]:hidden">
                {it.q}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <p className="mt-3 text-start text-sm leading-relaxed text-muted-foreground">{it.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
