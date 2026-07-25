"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  AtSign,
  CalendarDays,
  ChevronDown,
  Clock3,
  Menu,
  Search,
  Send,
  X,
} from "lucide-react";
import { useContent } from "@/lib/store";
import { useI18n, type Lang } from "@/lib/i18n";

interface NavChild {
  title: string;
  href: string;
}
interface NavItem {
  title: string;
  href?: string;
  children?: NavChild[];
}

function useNav(): NavItem[] {
  const { content } = useContent();
  const { t } = useI18n();
  return [
    { title: t("nav.home"), href: "/" },
    {
      title: t("nav.news"),
      children: [
        { title: t("nav.allNews"), href: "/news" },
        ...content.categories.map((c) => ({
          title: c.title,
          href: `/news?category=${c.id}`,
        })),
      ],
    },
    {
      title: t("nav.organs"),
      children: [
        { title: t("nav.organs"), href: "/p/arkan" },
        { title: t("organs.board"), href: "/p/modir" },
        { title: t("organs.presidium"), href: "/p/hayatraise" },
        { title: t("organs.inspectors"), href: "/p/bazrsin" },
        { title: t("organs.disciplinary"), href: "/p/shorayeentezami" },
        { title: t("organs.assembly"), href: "/p/majmaeomumi" },
      ],
    },
    {
      title: t("nav.units"),
      children: content.units.map((u) => ({
        title: u.title,
        href: `/tab-item/${u.id}`,
      })),
    },
    { title: t("nav.contact"), href: "/p/tamas" },
  ];
}

function LangSwitch() {
  const { lang, setLang } = useI18n();
  const options: { value: Lang; label: string }[] = [
    { value: "fa", label: "فارسی" },
    { value: "ku", label: "کوردی" },
  ];
  return (
    <div
      className="flex items-center rounded-lg border border-white/20 text-xs"
      role="group"
      aria-label="زبان / زمان"
    >
      {/* Buttons keep their exact visual size (24px tall); the inset
          pseudo-element grows the tap target to 44px tall without affecting
          layout. The wrapper's `overflow-hidden` was replaced by logical
          `rounded-s`/`rounded-e` on the first/last button — it would otherwise
          clip that pseudo-element and the hit area with it. */}
      {options.map((o, i) => (
        <button
          key={o.value}
          type="button"
          onClick={() => setLang(o.value)}
          aria-pressed={lang === o.value}
          className={`relative px-2.5 py-1 transition-colors before:absolute before:inset-x-0 before:-inset-y-2.5 before:content-[''] ${
            i === 0 ? "rounded-s-lg" : ""
          } ${i === options.length - 1 ? "rounded-e-lg" : ""} ${
            lang === o.value
              ? "bg-gold font-bold text-ink"
              : "text-mist hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* Brand title cycles fa → en → ku, like the organization's own site. */
const BRAND_TITLES = [
  {
    key: "fa",
    dir: "rtl" as const,
    name: "سازمان نظام مهندسی ساختمان",
    province: "استان کردستان",
  },
  {
    key: "en",
    dir: "ltr" as const,
    name: "Kurdistan Construction",
    province: "Engineering Organization",
  },
  {
    key: "ku",
    dir: "rtl" as const,
    name: "ڕێکخراوەی ئەندازیاریی بیناسازی",
    province: "پارێزگای کوردستان",
  },
];

function BrandTitle() {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(
      () => setI((prev) => (prev + 1) % BRAND_TITLES.length),
      4000
    );
    return () => clearInterval(t);
  }, []);

  const brand = BRAND_TITLES[i];

  return (
    <span className="relative block h-11 w-44 overflow-hidden sm:w-60">
      <AnimatePresence initial={false} mode="wait">
        <motion.span
          key={brand.key}
          dir={brand.dir}
          lang={brand.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="absolute inset-0 flex flex-col justify-center leading-tight"
        >
          <span className="block truncate text-sm font-bold sm:text-base">
            {brand.name}
          </span>
          <span className="block truncate text-xs text-mist">
            {brand.province}
          </span>
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

function TopStrip() {
  const { content } = useContent();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const date = now
    ? new Intl.DateTimeFormat("fa-IR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(now)
    : "";
  const time = now
    ? new Intl.DateTimeFormat("fa-IR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }).format(now)
    : "";

  return (
    <div className="bg-deeper text-mist text-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-2 px-4 py-1.5 sm:gap-4">
        <div className="flex items-center gap-4" suppressHydrationWarning>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-3.5" aria-hidden />
            {date}
          </span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <Clock3 className="size-3.5" aria-hidden />
            {time}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <LangSwitch />
          {/* Icons stay 16px; the inset pseudo-element supplies a 44x44 tap
              target. On mobile the pair is spread far enough apart (ms-4 on the
              second one) that the two targets never overlap; from `sm` the
              original 12px gap and a narrower inset are restored so desktop
              spacing is untouched and the targets still tile without overlap. */}
          <a
            href={content.settings.telegram}
            target="_blank"
            rel="noreferrer"
            aria-label="تلگرام سازمان"
            className="relative inline-flex transition-colors before:absolute before:-inset-y-3.5 before:-inset-x-3.5 before:content-[''] hover:text-white sm:before:-inset-x-1.5"
          >
            <Send className="size-4" />
          </a>
          <a
            href={content.settings.instagram}
            target="_blank"
            rel="noreferrer"
            aria-label="اینستاگرام سازمان"
            className="relative inline-flex ms-4 transition-colors before:absolute before:-inset-y-3.5 before:-inset-x-3.5 before:content-[''] hover:text-white sm:ms-0 sm:before:-inset-x-1.5"
          >
            <AtSign className="size-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function Header() {
  const nav = useNav();
  const { content } = useContent();
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setDrawer(false);
    setOpen(null);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setOpen(null);
      }
    }
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return (
    <header ref={headerRef} className="sticky top-0 z-50 shadow-card">
      <TopStrip />
      <div className="bg-ink text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 sm:py-3">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt="لوگوی سازمان نظام مهندسی ساختمان کردستان"
              width={52}
              height={52}
              className="rounded-md bg-white/95 p-1"
              priority
            />
            <BrandTitle />
          </Link>

          {/* Desktop nav */}
          <nav aria-label="ناوبری اصلی" className="hidden items-center gap-1 lg:flex">
            {nav.map((item) =>
              item.children ? (
                <div key={item.title} className="relative">
                  <button
                    type="button"
                    aria-expanded={open === item.title}
                    onClick={() =>
                      setOpen(open === item.title ? null : item.title)
                    }
                    className={`flex items-center gap-1 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/10 ${
                      open === item.title ? "bg-white/10" : ""
                    }`}
                  >
                    {item.title}
                    <ChevronDown
                      className={`size-4 transition-transform ${
                        open === item.title ? "rotate-180" : ""
                      }`}
                      aria-hidden
                    />
                  </button>
                  <AnimatePresence>
                    {open === item.title && (
                      <motion.ul
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 8 }}
                        transition={{ duration: 0.16, ease: "easeOut" }}
                        className="absolute end-0 top-full mt-2 w-56 overflow-hidden rounded-xl border border-line bg-white py-2 text-ink shadow-lift"
                      >
                        {item.children.map((child) => (
                          <li key={child.title}>
                            <Link
                              href={child.href}
                              className="block px-4 py-2 text-sm transition-colors hover:bg-paper hover:text-copper"
                            >
                              {child.title}
                            </Link>
                          </li>
                        ))}
                      </motion.ul>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Link
                  key={item.title}
                  href={item.href!}
                  className={`rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/10 ${
                    pathname === item.href ? "text-gold" : ""
                  }`}
                >
                  {item.title}
                </Link>
              )
            )}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="جستجو"
              onClick={() => setSearchOpen(true)}
              className="relative rounded-lg p-2 transition-colors before:absolute before:-inset-1 before:content-[''] hover:bg-white/10"
            >
              <Search className="size-5" />
            </button>
            <button
              type="button"
              aria-label="باز کردن منو"
              onClick={() => setDrawer(true)}
              className="relative rounded-lg p-2 transition-colors before:absolute before:-inset-0.5 before:content-[''] hover:bg-white/10 lg:hidden"
            >
              <Menu className="size-6" />
            </button>
          </div>
        </div>
      </div>

      {/* Search overlay */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink/70 backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
          >
            <motion.form
              initial={{ y: -24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -24, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              onClick={(e) => e.stopPropagation()}
              action="/news"
              className="mx-auto mt-28 flex max-w-xl items-center gap-2 rounded-2xl bg-white p-3 shadow-lift"
            >
              <Search className="size-5 shrink-0 text-steel" aria-hidden />
              <input
                autoFocus
                name="q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("nav.search")}
                className="w-full bg-transparent text-ink outline-none placeholder:text-steel"
              />
              <button
                type="button"
                aria-label="بستن جستجو"
                onClick={() => setSearchOpen(false)}
                className="relative rounded-lg p-1.5 text-steel before:absolute before:-inset-1.5 before:content-[''] hover:bg-paper"
              >
                <X className="size-5" />
              </button>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile drawer */}
      <AnimatePresence>
        {drawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-ink/60 backdrop-blur-sm lg:hidden"
              onClick={() => setDrawer(false)}
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-50 w-80 max-w-[85vw] overflow-y-auto bg-white text-ink shadow-lift lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-line p-4">
                <span className="font-bold">{t("nav.menu")}</span>
                <button
                  type="button"
                  aria-label="بستن منو"
                  onClick={() => setDrawer(false)}
                  className="relative rounded-lg p-2 before:absolute before:-inset-1 before:content-[''] hover:bg-paper"
                >
                  <X className="size-5" />
                </button>
              </div>
              <nav aria-label="ناوبری موبایل" className="p-4">
                {nav.map((item) =>
                  item.children ? (
                    <details key={item.title} className="group border-b border-line py-1">
                      <summary className="flex cursor-pointer list-none items-center justify-between rounded-lg px-2 py-3 font-medium hover:bg-paper">
                        {item.title}
                        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                      </summary>
                      <ul className="pb-2 ps-4">
                        {item.children.map((child) => (
                          <li key={child.title}>
                            <Link
                              href={child.href}
                              className="block rounded-lg px-2 py-2 text-sm text-steel hover:text-copper"
                            >
                              {child.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </details>
                  ) : (
                    <Link
                      key={item.title}
                      href={item.href!}
                      className="block border-b border-line px-2 py-3 font-medium hover:text-copper"
                    >
                      {item.title}
                    </Link>
                  )
                )}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </header>
  );
}
