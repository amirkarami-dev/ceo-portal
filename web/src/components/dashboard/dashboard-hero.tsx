"use client"

import { motion, useReducedMotion } from "framer-motion"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"

export function DashboardHero({ email }: { email?: string | null }) {
  const t = useTranslations("dashboard")
  const reduce = useReducedMotion()

  return (
    <motion.section
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 px-6 py-7 text-white shadow-lg sm:px-8 sm:py-9"
    >
      {/* Blueprint grid — same architectural texture as the projects hero, for consistency. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "26px 26px",
        }}
      />
      <div aria-hidden className="pointer-events-none absolute -right-12 -top-16 size-56 rounded-full bg-white/15 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -left-8 size-56 rounded-full bg-emerald-300/20 blur-3xl" />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          {email ? (
            <span className="inline-flex max-w-full items-center gap-2 truncate rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium text-white/90 ring-1 ring-inset ring-white/20 backdrop-blur">
              <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-emerald-200" />
              <span dir="ltr" className="truncate">{email}</span>
            </span>
          ) : null}
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-[28px]">{t("welcome")}</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/75 sm:text-[15px]">{t("subtitle")}</p>
        </div>

        <Link
          href="/projects"
          className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-brand-700 shadow-sm outline-none transition hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white/70 active:scale-[0.98]"
        >
          {t("viewProjects")}
          <svg className="size-4 flip-x" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <path d="m9 18 6-6-6-6" />
          </svg>
        </Link>
      </div>
    </motion.section>
  )
}
