"use client"

import { useLocale } from "next-intl"

export function Stats() {
  const locale = useLocale()
  const fa = locale === "fa"

  const items = [
    { value: fa ? "۶" : "6", label: fa ? "چک‌لیست تخصصی" : "Expert checklists" },
    { value: fa ? "۸۳۱" : "831", label: fa ? "امتیاز کل" : "Total points" },
    { value: fa ? "۶" : "6", label: fa ? "پهنه اقلیمی" : "Climate zones" },
    { value: "PDF", label: fa ? "خروجی فارسی" : "Persian output" },
  ]

  return (
    <section className="border-y border-border bg-muted/40">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px overflow-hidden px-4 py-10 sm:px-6 md:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="px-4 py-4 text-center">
            <div className="text-3xl font-extrabold text-primary">{it.value}</div>
            <div className="mt-1 text-sm text-muted-foreground">{it.label}</div>
          </div>
        ))}
      </div>
    </section>
  )
}
