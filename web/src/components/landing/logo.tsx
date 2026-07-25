"use client"

import { useLocale } from "next-intl"
import { Link } from "@/i18n/navigation"

export function Logo({ className }: { className?: string }) {
  const locale = useLocale()
  const fa = locale === "fa"
  return (
    <Link href="/" className={"inline-flex items-center gap-2 " + (className ?? "")}>
      <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
        <svg viewBox="0 0 24 24" fill="none" className="size-5" aria-hidden>
          <path
            d="M13 2 4 13h6l-1 9 9-11h-6l1-9z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className="flex flex-col leading-tight text-start">
        <span className="text-sm font-bold text-foreground">
          {fa ? "مبحث ۱۹" : "Mabhas19"}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground">
          {fa ? "ارزیابی انرژی ساختمان" : "Building Energy Assessment"}
        </span>
      </span>
    </Link>
  )
}
