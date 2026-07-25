"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { useHydrated } from "@/components/ui";
import {
  BadgeCheck,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileCog,
  Flame,
  HardHat,
  HeartHandshake,
  KeyRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useContent } from "@/lib/store";
import { imageUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

/* ── animated blueprint city (site signature) ──────────────
   A line-art construction skyline: buildings with flickering
   window lights, a tower crane with a swinging hook, marching
   dimension lines, and a slowly rotating compass dial. */

const WINDOWS: { x: number; y: number; d: number }[] = [
  // tower A
  { x: 96, y: 190, d: 0 }, { x: 128, y: 190, d: 2.1 }, { x: 160, y: 224, d: 0.8 },
  { x: 96, y: 258, d: 3.2 }, { x: 128, y: 292, d: 1.4 }, { x: 160, y: 326, d: 2.6 },
  // mid-rise B
  { x: 262, y: 268, d: 1.9 }, { x: 300, y: 268, d: 0.4 }, { x: 262, y: 320, d: 2.9 },
  { x: 300, y: 356, d: 1.1 },
  // glass tower E
  { x: 1052, y: 216, d: 0.6 }, { x: 1096, y: 216, d: 2.4 }, { x: 1052, y: 276, d: 1.6 },
  { x: 1096, y: 336, d: 3.4 },
];

function Skyline() {
  const hydrated = useHydrated();
  const draw = (delay: number, dur = 1.8) => ({
    initial: { pathLength: 0, opacity: 0 },
    animate: { pathLength: 1, opacity: 1 },
    transition: {
      pathLength: { duration: dur, delay, ease: "easeInOut" as const },
      opacity: { duration: 0.3, delay },
    },
  });
  if (!hydrated) return null; // decorative — skip SSR to keep hydration clean
  return (
    <svg
      viewBox="0 0 1440 420"
      preserveAspectRatio="xMidYMax meet"
      className="pointer-events-none absolute inset-x-0 bottom-0 w-full opacity-35"
      aria-hidden
      fill="none"
    >
      {/* Zagros ridge, two layers */}
      <motion.path
        d="M0 320 L150 218 L280 292 L440 180 L590 280 L740 200 L900 290 L1060 214 L1220 288 L1330 238 L1440 300"
        stroke="#7fb3c8"
        strokeWidth="1"
        opacity="0.55"
        {...draw(0.1, 2.2)}
      />
      <motion.path
        d="M0 356 L180 280 L340 340 L520 262 L700 336 L880 272 L1080 338 L1260 288 L1440 344"
        stroke="#7fb3c8"
        strokeWidth="1"
        opacity="0.35"
        {...draw(0.3, 2.2)}
      />

      {/* ── tower A: highrise with floors + antenna ── */}
      <motion.path
        d="M78 420 V168 h110 V420 M133 168 V120 M120 132 h26"
        stroke="#d9a441"
        strokeWidth="1.5"
        {...draw(0.5)}
      />
      <motion.path
        d="M78 202 h110 M78 236 h110 M78 270 h110 M78 304 h110 M78 338 h110 M78 372 h110 M114 168 V420 M150 168 V420"
        stroke="#d9a441"
        strokeWidth="0.75"
        opacity="0.6"
        {...draw(0.9)}
      />

      {/* ── mid-rise B with balcony ledges ── */}
      <motion.path
        d="M246 420 V246 h96 V420 M238 282 h8 M238 318 h8 M238 354 h8 M246 282 h96 M246 318 h96 M246 354 h96 M246 390 h96"
        stroke="#7fb3c8"
        strokeWidth="1.25"
        {...draw(0.7)}
      />

      {/* ── stepped building C ── */}
      <motion.path
        d="M396 420 V308 h44 V258 h52 V214 h42 V420 M396 344 h138 M396 382 h138 M440 308 H534 M492 258 h42"
        stroke="#d9a441"
        strokeWidth="1.25"
        {...draw(0.9)}
      />

      {/* ── tower crane ── */}
      <motion.path
        d="M640 420 V128 M656 420 V128 M640 156 l16 28 M656 156 l-16 28 M640 212 l16 28 M656 212 l-16 28 M640 268 l16 28 M656 268 l-16 28 M640 324 l16 28 M656 324 l-16 28 M624 420 h48"
        stroke="#c56a2b"
        strokeWidth="1.5"
        {...draw(1.1)}
      />
      <motion.path
        d="M584 128 H812 M648 96 L584 128 M648 96 L740 128 M648 96 L648 128 M584 128 v22 h26 v-22 M812 128 l-10 14"
        stroke="#c56a2b"
        strokeWidth="1.5"
        {...draw(1.4)}
      />
      {/* trolley cable + hook, slowly hoisting */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, y: [0, 30, 0] }}
        transition={{
          opacity: { delay: 2.2, duration: 0.5 },
          y: { duration: 7, repeat: Infinity, ease: "easeInOut", delay: 2.4 },
        }}
      >
        <path
          d="M756 130 V196 M748 196 h16 M756 196 v12 a8 8 0 0 0 8 8"
          stroke="#c56a2b"
          strokeWidth="1.5"
        />
      </motion.g>

      {/* ── building D: under construction (slabs + columns + scaffold) ── */}
      <motion.path
        d="M852 420 V256 M902 420 V256 M952 420 V256 M1002 420 V256 M844 256 h166 M844 312 h166 M844 368 h166 M852 312 l50 -56 M902 368 l50 -56 M952 312 l50 -56 M922 256 v-22 M962 256 v-16"
        stroke="#7fb3c8"
        strokeWidth="1.25"
        {...draw(1.3)}
      />

      {/* ── glass tower E with slanted crown ── */}
      <motion.path
        d="M1034 420 V190 L1090 158 L1146 190 V420 M1090 158 V420 M1034 246 h112 M1034 306 h112 M1034 366 h112"
        stroke="#d9a441"
        strokeWidth="1.25"
        {...draw(1.5)}
      />

      {/* ── low houses with pitched roofs ── */}
      <motion.path
        d="M1196 420 V356 h64 V420 M1188 356 l40 -30 40 30 M1218 420 v-34 h20 v34 M1292 420 V372 h56 V420 M1286 372 l34 -26 34 26"
        stroke="#7fb3c8"
        strokeWidth="1.25"
        {...draw(1.7)}
      />

      {/* ── blueprint annotations ── */}
      {/* marching dimension line over tower A */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.4 }}>
        <path d="M78 92 v-16 M188 92 v-16" stroke="#7fb3c8" strokeWidth="1" />
        <motion.line
          x1="78"
          y1="84"
          x2="188"
          y2="84"
          stroke="#7fb3c8"
          strokeWidth="1"
          strokeDasharray="5 7"
          animate={{ strokeDashoffset: [0, -120] }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        />
      </motion.g>
      {/* marching leader line to crane */}
      <motion.g initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.6 }}>
        <motion.path
          d="M470 70 H700"
          stroke="#7fb3c8"
          strokeWidth="1"
          strokeDasharray="4 8"
          animate={{ strokeDashoffset: [0, -132] }}
          transition={{ duration: 9, repeat: Infinity, ease: "linear" }}
        />
        <path d="M470 70 l10 -6 M470 70 l10 6" stroke="#7fb3c8" strokeWidth="1" />
      </motion.g>
      {/* rotating compass dial */}
      <motion.g
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, rotate: 360 }}
        style={{ transformOrigin: "1318px 96px" }}
        transition={{
          opacity: { delay: 2.2, duration: 0.6 },
          rotate: { duration: 46, repeat: Infinity, ease: "linear" },
        }}
      >
        <circle cx="1318" cy="96" r="42" stroke="#7fb3c8" strokeWidth="1" strokeDasharray="3 9" />
        <path d="M1318 62 V78 M1318 114 v16 M1284 96 h16 M1336 96 h16" stroke="#7fb3c8" strokeWidth="1" />
        <path d="M1318 82 l8 22 -8 -6 -8 6 z" stroke="#d9a441" strokeWidth="1" />
      </motion.g>
      {/* crosshair accents */}
      <motion.path
        d="M520 118 h16 M528 110 v16 M936 84 h16 M944 76 v16 M1216 176 h14 M1223 169 v14"
        stroke="#7fb3c8"
        strokeWidth="1"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7 }}
        transition={{ delay: 2.8, duration: 0.8 }}
      />

      {/* flickering window lights */}
      {WINDOWS.map((w, i) => (
        <motion.rect
          key={i}
          x={w.x}
          y={w.y}
          width="14"
          height="16"
          fill="#d9a441"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0.08, 0.55, 0.08] }}
          transition={{
            duration: 4.5 + (i % 4),
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2 + w.d,
          }}
        />
      ))}
    </svg>
  );
}

/* ── news slider ───────────────────────────────────────── */
function Slider() {
  const { content } = useContent();
  const slides = content.slides;
  const [index, setIndex] = useState(0);
  const reduce = useReducedMotion();
  const hydrated = useHydrated();
  const { t } = useI18n();

  const next = useCallback(
    () => setIndex((i) => (i + 1) % slides.length),
    [slides.length]
  );
  const prev = () => setIndex((i) => (i - 1 + slides.length) % slides.length);

  useEffect(() => {
    if (reduce || slides.length < 2) return;
    const t = setInterval(next, 6000);
    return () => clearInterval(t);
  }, [next, reduce, slides.length]);

  if (!slides.length) return null;
  const slide = slides[index];

  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-white/10 bg-deeper/70 shadow-lift backdrop-blur-sm"
      role="region"
      aria-roledescription="اسلایدر"
      aria-label="اخبار منتخب"
    >
      <div className="relative aspect-[16/10] sm:aspect-[16/8.5]">
        <AnimatePresence mode="wait">
          <motion.div
            key={slide.id}
            initial={hydrated ? { opacity: 0, scale: 1.03 } : false}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45 }}
            className="absolute inset-0"
          >
            <Image
              src={imageUrl(slide.image)}
              alt=""
              fill
              priority={index === 0}
              sizes="(max-width: 1024px) 100vw, 55vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-deeper via-deeper/40 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
              <span className="rounded-full bg-copper px-3 py-1 text-xs font-semibold text-white">
                {slide.badge}
              </span>
              <h3 className="mt-3 line-clamp-2 text-base font-bold leading-8 text-white sm:text-lg">
                {slide.title}
              </h3>
              <p className="mt-1 line-clamp-1 text-sm text-mist">{slide.subtitle}</p>
              {slide.newsId !== null && (
                <Link
                  href={`/news/${slide.newsId}`}
                  className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-gold hover:text-white"
                >
                  {t("hero.viewNews")}
                  <ChevronLeft className="size-4" aria-hidden />
                </Link>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="absolute left-4 top-4 flex items-center gap-2">
        <button
          type="button"
          onClick={prev}
          aria-label="اسلاید قبلی"
          className="relative grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-copper"
        >
          <ChevronRight className="size-5" />
        </button>
        <button
          type="button"
          onClick={next}
          aria-label="اسلاید بعدی"
          className="relative grid size-9 place-items-center rounded-full bg-white/15 text-white backdrop-blur-sm transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-copper"
        >
          <ChevronLeft className="size-5" />
        </button>
      </div>

      {/* slide counter */}
      <span className="absolute right-4 top-4 rounded-full bg-white/15 px-3 py-1 text-xs text-white backdrop-blur-sm">
        {(index + 1).toLocaleString("fa-IR")} / {slides.length.toLocaleString("fa-IR")}
      </span>

      {/* dots + autoplay progress */}
      <div className="absolute bottom-4 left-5 flex items-center gap-1.5" role="tablist">
        {slides.map((s, i) =>
          i === index && !reduce && hydrated ? (
            <span
              key={s.id}
              role="tab"
              aria-selected
              aria-label={`اسلاید ${i + 1}`}
              className="relative h-1.5 w-10 overflow-hidden rounded-full bg-white/30"
            >
              <motion.span
                key={`progress-${index}`}
                className="absolute inset-y-0 left-0 rounded-full bg-gold"
                initial={{ width: 0 }}
                animate={{ width: "100%" }}
                transition={{ duration: 6, ease: "linear" }}
              />
            </span>
          ) : (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`اسلاید ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`relative h-1.5 rounded-full transition-all before:absolute before:-inset-x-[3px] before:-inset-y-[19px] before:content-[''] ${
                i === index ? "w-7 bg-gold" : "w-2.5 bg-white/40 hover:bg-white/70"
              }`}
            />
          )
        )}
      </div>
    </div>
  );
}

/* ── portal dock (the service portals) ─────────────────── */
const portalIcons: Record<string, LucideIcon> = {
  engineer: HardHat,
  owner: KeyRound,
  // سامانه رفاهی مهندسین (refahi.kurdnezam.ir) — the welfare dashboard's quick-link.
  welfare: HeartHandshake,
  badge: BadgeCheck,
  membership: ClipboardList,
  automation: FileCog,
  gas: Flame,
  power: Zap,
};

export function PortalDock() {
  const { content } = useContent();
  const hydrated = useHydrated();
  return (
    <div className="relative z-10 mx-auto -mt-12 max-w-6xl px-4">
      <motion.ul
        key={hydrated ? "anim" : "ssr"}
        initial={hydrated ? { opacity: 0, y: 24 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="grid grid-cols-2 gap-3 rounded-2xl border border-line bg-white p-4 shadow-lift sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7"
      >
        {content.quickLinks.map((link, i) => {
          const Icon = portalIcons[link.icon] ?? Building2;
          return (
            <motion.li
              key={link.id}
              initial={hydrated ? { opacity: 0, y: 12 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.06 }}
            >
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="group flex h-full flex-col items-center gap-3 rounded-xl border border-transparent p-4 text-center transition-all hover:border-copper/30 hover:bg-copper-soft/50"
              >
                <span className="grid size-12 place-items-center rounded-xl bg-ink text-gold transition-colors group-hover:bg-copper group-hover:text-white">
                  <Icon className="size-6" aria-hidden />
                </span>
                <span className="text-sm font-medium leading-6 text-ink">
                  {link.title}
                </span>
              </a>
            </motion.li>
          );
        })}
      </motion.ul>
    </div>
  );
}

/* ── hero ──────────────────────────────────────────────── */
export default function Hero() {
  const { content } = useContent();
  const hydrated = useHydrated();
  const { t, lang } = useI18n();
  const { scrollY } = useScroll();
  const skylineY = useTransform(scrollY, [0, 600], [0, 80]);

  const locale = lang === "ku" ? "ckb-IR" : "fa-IR";
  const stats = [
    { value: `+${(8000).toLocaleString(locale)}`, label: t("hero.statMembers") },
    {
      value: (
        content.tabGroups.find((g) => g.slug === "groups")?.items.length ?? 7
      ).toLocaleString(locale),
      label: t("hero.statGroups"),
    },
    {
      value: (
        content.tabGroups.find((g) => g.slug === "offices")?.items.length ?? 8
      ).toLocaleString(locale),
      label: t("hero.statOffices"),
    },
  ];

  return (
    <section className="blueprint relative overflow-hidden pb-24 pt-12 text-white sm:pt-16">
      {/* ambient glows */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -top-32 end-[-8%] size-[30rem] rounded-full bg-copper/20 blur-3xl"
        animate={{ opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute bottom-0 start-[-6%] size-[26rem] rounded-full bg-[#7fb3c8]/15 blur-3xl"
        animate={{ opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 11, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      {/* skyline with scroll parallax */}
      <motion.div style={{ y: skylineY }} className="absolute inset-0" aria-hidden>
        <Skyline />
      </motion.div>

      <div
        key={hydrated ? "anim" : "ssr"}
        className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 lg:grid-cols-[1fr_1.15fr]"
      >
        <motion.div
          initial={hydrated ? { opacity: 0, y: 20 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          
          <h1 className="mt-5 font-display text-3xl leading-snug sm:text-4xl lg:text-5xl">
            <span className="block">{t("hero.title1")}</span>
            <span className="block">{t("hero.title2")}</span>
            <span className="text-shimmer block pb-1">{t("hero.title3")}</span>
          </h1>
          <p className="mt-4 max-w-lg text-base leading-8 text-mist">
            {t("hero.tagline")}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href="/news"
              className="group inline-flex items-center gap-2 rounded-xl bg-copper px-6 py-3 font-semibold shadow-lift transition-all hover:bg-copper-dark"
            >
              {t("hero.newsBtn")}
              <ChevronLeft
                className="size-4 transition-transform group-hover:-translate-x-1"
                aria-hidden
              />
            </Link>
            <Link
              href="/p/arkan"
              className="rounded-xl border border-white/25 px-6 py-3 font-semibold backdrop-blur-sm transition-colors hover:border-gold hover:text-gold"
            >
              {t("hero.aboutBtn")}
            </Link>
          </div>

          {/* stats trio */}
          <motion.div
            initial={hydrated ? { opacity: 0, y: 16 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.35 }}
            className="mt-9 grid max-w-md grid-cols-3 overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm"
          >
            {stats.map((s, i) => (
              <div
                key={s.label}
                className={`px-3 py-3.5 text-center ${
                  i > 0 ? "border-s border-white/10" : ""
                }`}
              >
                <p className="text-xl font-bold text-gold">{s.value}</p>
                <p className="mt-1 text-xs leading-5 text-mist">{s.label}</p>
              </div>
            ))}
          </motion.div>
        </motion.div>

        <motion.div
          initial={hydrated ? { opacity: 0, y: 28 } : false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <Slider />
        </motion.div>
      </div>
    </section>
  );
}
