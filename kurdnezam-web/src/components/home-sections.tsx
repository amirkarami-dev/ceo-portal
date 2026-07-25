"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, LayoutGroup, motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronLeft,
  ClipboardPen,
  FolderOpen,
  Megaphone,
  Newspaper,
  Network,
  UserRound,
  X,
} from "lucide-react";
import { useContent } from "@/lib/store";
import { imageUrl } from "@/lib/api";
import { ArticleBody, AttachmentList } from "@/components/article";
import { useI18n } from "@/lib/i18n";
import type { Category, NewsItem, TabGroup } from "@/data/content";
import { useHydrated } from "@/components/ui";

/* ── announcement ticker ───────────────────────────────── */
export function Ticker() {
  const { content } = useContent();
  const { t } = useI18n();
  const items = content.news.slice(0, 6);
  const doubled = [...items, ...items];
  return (
    <div className="border-b border-line bg-white">
      <div className="mx-auto flex max-w-7xl items-center gap-4 overflow-hidden px-4 py-3">
        <span className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-copper px-3 py-1.5 text-sm font-bold text-white">
          <Megaphone className="size-4" aria-hidden />
          {t("home.fresh")}
        </span>
        <div className="relative flex-1 overflow-hidden" dir="ltr">
          <ul className="flex w-max animate-ticker gap-10 hover:[animation-play-state:paused]">
            {doubled.map((n, i) => (
              <li key={`${n.id}-${i}`} dir="rtl" className="whitespace-nowrap text-sm">
                <Link href={`/news/${n.id}`} className="text-steel transition-colors hover:text-copper">
                  <span className="me-2 text-gold">◆</span>
                  {n.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ── in-place reading modal (shared-layout expansion) ──── */
function NewsReader({
  item,
  onClose,
}: {
  item: NewsItem;
  onClose: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  return (
    <>
      <motion.div
        className="fixed inset-0 z-40 bg-ink/70 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        layoutId={`news-${item.id}`}
        role="dialog"
        aria-modal="true"
        aria-label={item.title}
        className="fixed inset-3 z-50 overflow-hidden rounded-3xl border border-line bg-white shadow-lift sm:inset-8 lg:inset-x-40 lg:inset-y-12"
      >
        <motion.button
          type="button"
          aria-label={t("common.close")}
          onClick={onClose}
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          className="absolute end-4 top-4 z-10 grid size-10 place-items-center rounded-full bg-ink/70 text-white backdrop-blur-sm transition-colors hover:bg-copper"
        >
          <X className="size-5" />
        </motion.button>

        <div className="h-full overflow-y-auto">
          {/* No cover image in the quick-view on purpose: this dialog is for READING the
              announcement, and the picture is usually a scan of the same letter. It pushed the
              text below the fold. The image stays on the full article page. */}
          <div className="p-5 sm:p-8">
            <div className="flex flex-wrap items-center gap-4">
              <span className="rounded-full bg-copper-soft px-3 py-1 text-xs font-semibold text-copper-dark">
                {item.categoryTitle}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-steel">
                <CalendarDays className="size-3.5" aria-hidden />
                {item.date}
              </span>
              <span className="inline-flex items-center gap-1.5 text-xs text-steel">
                <UserRound className="size-3.5" aria-hidden />
                {item.author}
              </span>
            </div>
            <motion.h2
              layoutId={`news-title-${item.id}`}
              className="mt-4 font-display text-2xl leading-snug sm:text-3xl"
            >
              {item.title}
            </motion.h2>
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.35 }}
              className="mt-5 text-base leading-8 text-ink/85"
            >
              <ArticleBody body={item.body} className="article-body" />

              {item.attachments && item.attachments.length > 0 ? (
                <div className="mb-6 mt-6">
                  <AttachmentList items={item.attachments} />
                </div>
              ) : null}

              <Link
                href={`/news/${item.id}`}
                className="mt-2 inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-copper"
              >
                {t("common.openFull")}
                <ArrowLeft className="size-4" aria-hidden />
              </Link>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </>
  );
}

/* ── Jalali date tiles ─────────────────────────────────── */
const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const MONTHS_FA = [
  "فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
  "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند",
];
const MONTHS_KU = [
  "خاکەلێوە", "گوڵان", "جۆزەردان", "پووشپەڕ", "گەلاوێژ", "خەرمانان",
  "ڕەزبەر", "گەڵاڕێزان", "سەرماوەز", "بەفرانبار", "ڕێبەندان", "ڕەشەمە",
];

function toLatinInt(s: string) {
  return parseInt(
    s.replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d))),
    10
  );
}

function dateParts(date: string, lang: string) {
  const seg = date.split("/");
  if (seg.length < 3) return { day: date, month: "" };
  const months = lang === "ku" ? MONTHS_KU : MONTHS_FA;
  return { day: seg[2], month: months[toLatinInt(seg[1]) - 1] ?? "" };
}

/* ── news hub: light editorial panel (twin of the dark
   units panel) — vertical category rail with counts and a
   sliding indicator, featured story, date-tile headlines,
   and a forms strip. Cards expand in place into the reader. */
export function NewsHub() {
  const { content } = useContent();
  const { t, lang } = useI18n();
  const [cat, setCat] = useState(() => content.categories[0]?.id ?? 0);
  const [selected, setSelected] = useState<NewsItem | null>(null);
  const hydrated = useHydrated();

  const items = useMemo(
    () => content.news.filter((n) => n.categoryId === cat),
    [content.news, cat]
  );
  const featured = items[0];
  const rest = items.slice(1, 5);

  /** Published-item count, denormalised by the API. */
  const countOf = (category: Category) =>
    category.newsCount.toLocaleString(lang === "ku" ? "ckb-IR" : "fa-IR");

  return (
    <section className="mx-auto max-w-7xl px-4 py-14">
      <div className="relative rounded-3xl border border-line bg-white p-6 shadow-card sm:p-10">
        <LayoutGroup>
          {/* [&>*]:min-w-0 — grid items default to min-width:auto and refuse to shrink below their
              content's min-content width, which pushed this column to 728px on a 375px screen. */}
          <div className="grid gap-8 lg:grid-cols-[300px_1fr] [&>*]:min-w-0">
            {/* intro + vertical category rail */}
            <div className="flex flex-col">
              <span className="grid size-12 place-items-center rounded-xl bg-ink text-gold">
                <Megaphone className="size-6" aria-hidden />
              </span>
              <h2 className="mt-4 font-display text-3xl leading-tight">
                {t("home.latestNews")}
              </h2>
              <p className="mt-2 text-sm leading-7 text-steel">
                {t("home.latestNewsSub")}
              </p>

              <nav
                role="tablist"
                aria-label={t("news.category")}
                className="mt-6 flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
              >
                {content.categories.map((c) => {
                  const isActive = cat === c.id;
                  return (
                    <button
                      key={c.id}
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setCat(c.id)}
                      className={`relative flex shrink-0 items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors lg:w-full ${
                        isActive ? "text-white" : "text-steel hover:text-copper"
                      }`}
                    >
                      {isActive && hydrated && (
                        <motion.span
                          layoutId="news-nav-indicator"
                          className="absolute inset-0 rounded-xl bg-ink"
                          transition={{ type: "spring", stiffness: 400, damping: 32 }}
                        />
                      )}
                      <span className="relative font-medium">{c.title}</span>
                      <span
                        className={`relative ms-auto grid min-w-7 place-items-center rounded-full px-2 py-0.5 text-xs transition-colors ${
                          isActive ? "bg-gold text-ink" : "bg-paper text-steel"
                        }`}
                      >
                        {countOf(c)}
                      </span>
                    </button>
                  );
                })}
              </nav>

              <Link
                href="/news"
                className="group mt-6 flex items-center justify-between rounded-xl border border-line bg-paper px-4 py-3 transition-all hover:border-copper/40 hover:bg-white hover:shadow-card lg:mt-auto"
              >
                <span className="flex items-center gap-2.5 text-sm font-semibold">
                  <Newspaper className="size-4.5 text-copper" aria-hidden />
                  {t("home.archive")}
                </span>
                <ArrowLeft className="size-4 text-copper transition-transform group-hover:-translate-x-1" />
              </Link>
            </div>

            {/* featured story + date-tile headlines */}
            <AnimatePresence mode="wait">
              <motion.div
                key={hydrated ? cat : "ssr"}
                role="tabpanel"
                initial={hydrated ? { opacity: 0 } : false}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="grid content-start gap-5 md:grid-cols-[1.15fr_1fr]"
              >
                {featured ? (
                  <>
                    {/* featured story — expands in place */}
                    {selected?.id !== featured.id ? (
                      <motion.article
                        layoutId={`news-${featured.id}`}
                        onClick={() => setSelected(featured)}
                        className="group relative cursor-pointer overflow-hidden rounded-2xl border border-line shadow-card transition-shadow hover:shadow-lift"
                        whileHover={{ y: -3 }}
                        transition={{ type: "spring", stiffness: 400, damping: 26 }}
                      >
                        <motion.div
                          layoutId={`news-image-${featured.id}`}
                          className="relative aspect-[16/11]"
                        >
                          <Image
                            src={imageUrl(featured.image)}
                            alt=""
                            fill
                            sizes="(max-width: 768px) 100vw, 40vw"
                            className="object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-deeper via-deeper/30 to-transparent" />
                        </motion.div>
                        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                          <span className="rounded-full bg-copper px-3 py-1 text-xs font-semibold">
                            {featured.categoryTitle}
                          </span>
                          <motion.h3
                            layoutId={`news-title-${featured.id}`}
                            className="mt-3 line-clamp-2 font-bold leading-7"
                          >
                            {featured.title}
                          </motion.h3>
                          <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-mist">
                            <CalendarDays className="size-3.5" aria-hidden />
                            {featured.date}
                          </span>
                        </div>
                      </motion.article>
                    ) : (
                      <div aria-hidden />
                    )}

                    {/* date-tile headline list */}
                    <ul className="flex flex-col gap-2.5">
                      {rest.length ? (
                        rest.map((n, i) => {
                          if (selected?.id === n.id)
                            return <li key={n.id} className="h-17" aria-hidden />;
                          const d = dateParts(n.date, lang);
                          return (
                            <motion.li
                              key={n.id}
                              initial={hydrated ? { opacity: 0, x: 16 } : false}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05, duration: 0.3 }}
                            >
                              <motion.button
                                type="button"
                                layoutId={`news-${n.id}`}
                                onClick={() => setSelected(n)}
                                className="group flex w-full items-center gap-4 rounded-2xl border border-line bg-paper p-3 text-start transition-all hover:border-copper/40 hover:bg-white hover:shadow-card"
                              >
                                <span className="flex size-13 shrink-0 flex-col items-center justify-center rounded-xl bg-ink text-white transition-colors group-hover:bg-copper">
                                  <span className="text-base font-bold leading-5">
                                    {d.day}
                                  </span>
                                  {/* text-xs (12px) is the floor for legible Persian/Kurdish
                                      script; leading-4 keeps the two-line tile compact. */}
                                  <span className="text-xs leading-4 text-gold group-hover:text-white">
                                    {d.month}
                                  </span>
                                </span>
                                <motion.span
                                  layoutId={`news-title-${n.id}`}
                                  className="line-clamp-2 min-w-0 text-sm font-medium leading-6 text-ink transition-colors group-hover:text-copper"
                                >
                                  {n.title}
                                </motion.span>
                                <ChevronLeft className="ms-auto size-4 shrink-0 text-steel transition-transform group-hover:-translate-x-0.5 group-hover:text-copper" />
                              </motion.button>
                            </motion.li>
                          );
                        })
                      ) : (
                        <li className="grid flex-1 place-items-center rounded-2xl border border-dashed border-line py-10 text-center text-sm text-steel">
                          {t("common.readMore")} ←
                        </li>
                      )}
                      <li className="mt-auto">
                        {/* before:-inset-3 grows the tap target from 20px to 44px tall
                            without changing the rendered size or position of the label. */}
                        <Link
                          href={`/news?category=${cat}`}
                          className="relative inline-flex items-center gap-1 px-1 text-sm font-semibold text-copper hover:text-copper-dark before:absolute before:-inset-3 before:content-['']"
                        >
                          {t("home.viewAll")}
                          <ArrowLeft className="size-4" aria-hidden />
                        </Link>
                      </li>
                    </ul>
                  </>
                ) : (
                  <div className="grid place-items-center gap-3 rounded-2xl border border-dashed border-line py-16 text-steel md:col-span-2">
                    <Newspaper className="size-10" aria-hidden />
                    <p>{t("home.noNews")}</p>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* in-place reader */}
          <AnimatePresence>
            {selected && (
              <NewsReader item={selected} onClose={() => setSelected(null)} />
            )}
          </AnimatePresence>
        </LayoutGroup>
      </div>
    </section>
  );
}

/* ── units & groups: dark blueprint bento panel ─────────── */
export function UnitsCompact() {
  const { content } = useContent();
  const { t, lang } = useI18n();
  /** Holds a `TabGroup.slug`, not the numeric id. */
  const [active, setActive] = useState("units");
  const hydrated = useHydrated();
  const group = content.tabGroups.find((g) => g.slug === active);

  /** The `units` group carries no items — it renders `content.units` instead. */
  const countOf = (g: TabGroup) =>
    (g.slug === "units" ? content.units.length : g.items.length).toLocaleString(
      lang === "ku" ? "ckb-IR" : "fa-IR"
    );

  return (
    <section className="mx-auto max-w-7xl px-4 pb-16 pt-2">
      <div className="blueprint relative overflow-hidden rounded-3xl p-6 text-white sm:p-10">
        {/* corner crosshair accent */}
        <svg
          className="pointer-events-none absolute start-6 top-6 size-16 opacity-40"
          viewBox="0 0 64 64"
          aria-hidden
          fill="none"
          stroke="#7fb3c8"
          strokeWidth="1"
        >
          <path d="M8 32 h48 M32 8 v48" />
          <circle cx="32" cy="32" r="14" strokeDasharray="3 6" />
        </svg>

        {/* [&>*]:min-w-0 — see NewsHub above; without it the nested card grid forces horizontal scroll. */}
        <div className="relative grid gap-8 lg:grid-cols-[300px_1fr] [&>*]:min-w-0">
          {/* intro + vertical group navigator */}
          <div>
            <span className="grid size-12 place-items-center rounded-xl bg-white/10 text-gold">
              <Network className="size-6" aria-hidden />
            </span>
            <h2 className="mt-4 font-display text-3xl leading-tight">
              {t("home.unitsTitle")}
            </h2>
            <p className="mt-2 text-sm leading-7 text-mist">
              {t("home.unitsSub")}
            </p>

            <nav
              role="tablist"
              aria-label={t("home.unitsTitle")}
              className="mt-6 flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0"
            >
              {content.tabGroups.map((g) => {
                const selected = active === g.slug;
                return (
                  <button
                    key={g.id}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => setActive(g.slug)}
                    className={`relative flex shrink-0 items-center gap-3 rounded-xl px-4 py-2.5 text-sm transition-colors lg:w-full ${
                      selected ? "text-white" : "text-mist hover:text-white"
                    }`}
                  >
                    {selected && hydrated && (
                      <motion.span
                        layoutId="units-nav-indicator"
                        className="absolute inset-0 rounded-xl border border-gold/40 bg-white/10"
                        transition={{ type: "spring", stiffness: 400, damping: 32 }}
                      />
                    )}
                    <span className="relative font-medium">{g.title}</span>
                    <span
                      className={`relative ms-auto grid min-w-7 place-items-center rounded-full px-2 py-0.5 text-xs transition-colors ${
                        selected ? "bg-gold text-ink" : "bg-white/10 text-mist"
                      }`}
                    >
                      {countOf(g)}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* bento cards for the active group */}
          <AnimatePresence mode="wait">
            <motion.div
              key={hydrated ? active : "ssr"}
              role="tabpanel"
              initial={hydrated ? { opacity: 0 } : false}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="grid content-start gap-3 sm:grid-cols-2 xl:grid-cols-3"
            >
              {active === "units"
                ? content.units.map((u, i) => (
                    <motion.div
                      key={u.id}
                      initial={hydrated ? { opacity: 0, y: 14 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.3 }}
                    >
                      <Link
                        href={`/tab-item/${u.id}`}
                        className="group flex h-full flex-col rounded-2xl border border-white/10 bg-white/5 p-5 transition-all hover:border-gold/40 hover:bg-white/10"
                      >
                        <div className="flex items-center justify-between">
                          <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-gold transition-colors group-hover:bg-copper group-hover:text-white">
                            <Building2 className="size-5" aria-hidden />
                          </span>
                          <ChevronLeft className="size-4 text-mist transition-transform group-hover:-translate-x-1 group-hover:text-gold" />
                        </div>
                        <h3 className="mt-3 font-bold">{u.title}</h3>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-6 text-mist">
                          {u.description}
                        </p>
                      </Link>
                    </motion.div>
                  ))
                : group?.items.map((item, i) => (
                    <motion.div
                      key={item.id}
                      initial={hydrated ? { opacity: 0, y: 14 } : false}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04, duration: 0.3 }}
                    >
                      {item.href ? (
                        <Link
                          href={item.href}
                          className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-4 transition-all hover:border-gold/40 hover:bg-white/10"
                        >
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-gold transition-colors group-hover:bg-copper group-hover:text-white">
                            <FolderOpen className="size-5" aria-hidden />
                          </span>
                          <span className="text-sm font-medium">{item.title}</span>
                          <ChevronLeft className="ms-auto size-4 text-mist transition-transform group-hover:-translate-x-1 group-hover:text-gold" />
                        </Link>
                      ) : (
                        <span className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
                          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 text-mist">
                            <FolderOpen className="size-5" aria-hidden />
                          </span>
                          <span className="text-sm text-mist">{item.title}</span>
                          <span className="ms-auto rounded-full bg-white/10 px-2.5 py-0.5 text-xs text-mist">
                            {t("home.soon")}
                          </span>
                        </span>
                      )}
                    </motion.div>
                  ))}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* active forms strip */}
        <div className="relative mt-8 flex flex-wrap items-center gap-x-6 gap-y-4 border-t border-white/10 pt-6">
          <h3 className="flex shrink-0 items-center gap-2 font-bold">
            <ClipboardPen className="size-5 text-gold" aria-hidden />
            {t("home.activeForms")}
          </h3>
          <ul className="grid flex-1 gap-3 sm:grid-cols-2">
            {content.forms.map((form) => (
              <li key={form.id}>
                <Link
                  href={`/forms/${form.id}`}
                  className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 transition-all hover:border-gold/40 hover:bg-white/10"
                >
                  <span className="relative size-11 shrink-0 overflow-hidden rounded-lg">
                    <Image
                      src={imageUrl(form.image)}
                      alt=""
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  </span>
                  <span className="min-w-0">
                    <span className="line-clamp-1 text-sm font-medium">
                      {form.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-mist">
                      <CalendarDays className="size-3" aria-hidden />
                      {t("home.deadline")}: {form.deadline}
                    </span>
                  </span>
                  <ArrowLeft className="ms-auto size-4 shrink-0 text-gold transition-transform group-hover:-translate-x-0.5" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
