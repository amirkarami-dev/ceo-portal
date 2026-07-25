"use client";

import Link from "next/link";
import Image from "next/image";
import { useSyncExternalStore } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { NewsItem, Person } from "@/data/content";
import { imageUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/* ── hydration gate ────────────────────────────────────────
   framer-motion resolves `initial` differently on clients with
   prefers-reduced-motion, which breaks SSR hydration. Render
   the final state on the server and first client paint, then
   remount with animations enabled. */
const noopSubscribe = () => () => {};
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );
}

/* ── scroll-reveal wrapper ─────────────────────────────── */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const hydrated = useHydrated();
  return (
    <motion.div
      key={hydrated ? "anim" : "ssr"}
      className={className}
      initial={hydrated ? { opacity: 0, y: 24 } : false}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/* ── section heading with icon ─────────────────────────── */
export function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  action?: { title: string; href: string };
}) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-ink text-gold shadow-card">
          <Icon className="size-6" aria-hidden />
        </span>
        <div>
          <h2 className="font-display text-3xl leading-none text-ink sm:text-4xl">
            {title}
          </h2>
          {subtitle && <p className="mt-1.5 text-sm text-steel">{subtitle}</p>}
        </div>
      </div>
      {/* before:-inset-3 grows the tap target from 20px to 44px tall without
          changing the rendered size or position of the label. */}
      {action && (
        <Link
          href={action.href}
          className="group relative inline-flex items-center gap-1 text-sm font-medium text-copper hover:text-copper-dark before:absolute before:-inset-3 before:content-['']"
        >
          {action.title}
          <ChevronLeft className="size-4 transition-transform group-hover:-translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}

/* ── breadcrumb ────────────────────────────────────────── */
export function Breadcrumb({ items }: { items: { title: string; href?: string }[] }) {
  const { t } = useI18n();
  return (
    <nav aria-label="مسیر صفحه" className="mb-6 text-sm text-steel">
      <ol className="flex flex-wrap items-center gap-1.5">
        <li>
          <Link href="/" className="hover:text-copper">
            {t("common.home")}
          </Link>
        </li>
        {items.map((item) => (
          <li key={item.title} className="flex items-center gap-1.5">
            <ChevronLeft className="size-3.5" aria-hidden />
            {item.href ? (
              <Link href={item.href} className="hover:text-copper">
                {item.title}
              </Link>
            ) : (
              <span className="text-ink">{item.title}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/* ── news card ─────────────────────────────────────────── */
export function NewsCard({ item, index = 0 }: { item: NewsItem; index?: number }) {
  const { t } = useI18n();
  return (
    <Reveal delay={Math.min(index * 0.06, 0.3)}>
      <article className="group h-full overflow-hidden rounded-2xl border border-line bg-white shadow-card transition-shadow hover:shadow-lift">
        <Link href={`/news/${item.id}`} className="block">
          <div className="relative aspect-[16/9] overflow-hidden bg-paper">
            <Image
              src={imageUrl(item.image)}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <span className="absolute right-3 top-3 rounded-full bg-ink/85 px-3 py-1 text-xs text-gold backdrop-blur-sm">
              {item.categoryTitle || "اخبار"}
            </span>
          </div>
          <div className="flex flex-col gap-3 p-5">
            <span className="inline-flex items-center gap-1.5 text-xs text-steel">
              <CalendarDays className="size-3.5" aria-hidden />
              {item.date}
            </span>
            <h3 className="line-clamp-2 font-bold leading-7 text-ink transition-colors group-hover:text-copper">
              {item.title}
            </h3>
            <p className="line-clamp-2 text-sm leading-6 text-steel">
              {item.summary}
            </p>
            <span className="mt-auto inline-flex items-center gap-1 text-sm font-medium text-copper">
              {t("common.readMore")}
              <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
            </span>
          </div>
        </Link>
      </article>
    </Reveal>
  );
}

/* ── person card ───────────────────────────────────────── */
export function PersonCard({ person, index = 0 }: { person: Person; index?: number }) {
  return (
    <Reveal delay={Math.min(index * 0.05, 0.35)}>
      <article className="group flex h-full flex-col items-center rounded-2xl border border-line bg-white p-6 text-center shadow-card transition-shadow hover:shadow-lift">
        <div className="relative size-28 overflow-hidden rounded-full border-4 border-paper shadow-card">
          {person.image ? (
            <Image
              src={imageUrl(person.image)}
              alt={person.name}
              fill
              sizes="112px"
              className="object-cover transition-transform duration-500 group-hover:scale-108"
            />
          ) : (
            <span className="grid size-full place-items-center bg-ink text-mist">
              <UserRound className="size-12" aria-hidden />
            </span>
          )}
        </div>
        <h3 className="mt-4 font-bold text-ink">{person.name}</h3>
        <p className="mt-2 rounded-full bg-copper-soft px-3 py-1 text-xs text-copper-dark">
          {person.role}
        </p>
      </article>
    </Reveal>
  );
}
