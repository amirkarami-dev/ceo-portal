import type { ReactNode } from "react"
import { getTranslations } from "next-intl/server"
import { Card } from "@/components/ui"
import { LangSwitcher } from "@/components/lang-switcher"

export default async function AuthLayout({
  children,
}: {
  children: ReactNode
}) {
  const t = await getTranslations("app")

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-muted px-4 py-10">
      {/* subtle radial accent */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.6]"
        style={{
          background:
            "radial-gradient(60rem 30rem at 50% -10%, color-mix(in oklch, var(--primary) 14%, transparent), transparent)",
        }}
        aria-hidden
      />
      <div className="relative z-10 mb-6 flex w-full max-w-md items-center justify-between">
        <div className="flex items-center gap-3 text-start">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 21h18" />
              <path d="M5 21V7l7-4 7 4v14" />
              <path d="M9 21v-6h6v6" />
            </svg>
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-base font-bold text-foreground">{t("name")}</span>
            <span className="text-xs text-muted-foreground">{t("tagline")}</span>
          </div>
        </div>
        <LangSwitcher />
      </div>

      <Card className="relative z-10 w-full max-w-md">{children}</Card>
    </div>
  )
}
