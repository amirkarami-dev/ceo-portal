"use client"

import { motion, useReducedMotion, type Variants } from "framer-motion"
import { useLocale, useTranslations } from "next-intl"

function fmt(locale: string, n: number): string {
  return new Intl.NumberFormat(locale === "fa" ? "fa-IR" : "en-US").format(Math.round(n))
}

export function ProjectsHero({
  total,
  assessed,
  totalArea,
  onNew,
}: {
  total: number
  assessed: number
  totalArea: number
  onNew: () => void
}) {
  const t = useTranslations("projects")
  const tapp = useTranslations("app")
  const locale = useLocale()
  const reduce = useReducedMotion()

  const stats = [
    { label: t("statTotal"), value: fmt(locale, total) },
    { label: t("statAssessed"), value: fmt(locale, assessed) },
    { label: t("statArea"), value: fmt(locale, totalArea) },
  ]

  const statsContainer: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : 0.08, delayChildren: reduce ? 0 : 0.15 } },
  }
  const statItem: Variants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { duration: reduce ? 0 : 0.4, ease: "easeOut" } },
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: -14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduce ? 0 : 0.5, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-brand-700 to-brand-800 px-6 py-7 text-white shadow-lg sm:px-8 sm:py-9"
    >
      {/* Blueprint grid — quiet architectural texture for an engineering product. */}
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

      <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-[11px] font-medium text-white/90 ring-1 ring-inset ring-white/20 backdrop-blur">
            <span aria-hidden className="size-1.5 rounded-full bg-emerald-200" />
            {tapp("tagline")}
          </span>
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-[28px]">{t("title")}</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-white/75 sm:text-[15px]">{t("subtitle")}</p>
          <button
            type="button"
            onClick={onNew}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-white px-4 text-sm font-semibold text-brand-700 shadow-sm outline-none transition hover:bg-white/90 focus-visible:ring-2 focus-visible:ring-white/70 active:scale-[0.98]"
          >
            <svg className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            {t("newProject")}
          </button>
        </div>

        <motion.dl
          variants={statsContainer}
          initial="hidden"
          animate="show"
          className="grid w-full grid-cols-3 gap-3 sm:max-w-md lg:w-auto"
        >
          {stats.map((s) => (
            <motion.div
              key={s.label}
              variants={statItem}
              className="rounded-xl bg-white/10 px-3.5 py-3 text-center ring-1 ring-inset ring-white/15 backdrop-blur sm:px-4"
            >
              <dd className="text-xl font-extrabold tabular-nums sm:text-2xl">{s.value}</dd>
              <dt className="mt-1 text-[10.5px] font-medium text-white/70">{s.label}</dt>
            </motion.div>
          ))}
        </motion.dl>
      </div>
    </motion.section>
  )
}
