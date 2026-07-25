"use client"

import { useLocale } from "next-intl"
import { usePathname, useRouter } from "@/i18n/navigation"
import { routing } from "@/i18n/routing"

const LABELS: Record<string, string> = { fa: "فارسی", en: "English" }

export function LangSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  const switchTo = (next: string) => {
    if (next === locale) return
    router.replace(pathname, { locale: next as (typeof routing.locales)[number] })
  }

  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-xs">
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          className={
            "px-3 py-1.5 transition-colors " +
            (l === locale ? "bg-brand-700 text-white" : "bg-white text-slate-600 hover:bg-slate-50")
          }
        >
          {LABELS[l] ?? l}
        </button>
      ))}
    </div>
  )
}
