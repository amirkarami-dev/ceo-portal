"use client";

import Link from "next/link";
import Image from "next/image";
import {
  AtSign,
  Eye,
  Link2,
  MapPin,
  Phone,
  Mail,
  Send,
  Users,
  Wifi,
} from "lucide-react";
import { useContent } from "@/lib/store";
import { useI18n } from "@/lib/i18n";

export default function Footer() {
  const { content } = useContent();
  const { t, lang } = useI18n();
  const s = content.settings;
  const locale = lang === "ku" ? "ckb-IR" : "fa-IR";
  const num = (n: number) => n.toLocaleString(locale);

  return (
    <footer className="blueprint mt-16 text-mist">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        {/* Brand + stats */}
        <div>
          <div className="flex items-center gap-3">
            <Image
              src="/images/logo.png"
              alt=""
              width={56}
              height={56}
              className="rounded-lg bg-white/95 p-1"
            />
            <div className="leading-tight">
              <p className="font-bold text-white">
                {lang === "ku" ? s.nameKu : s.nameFa}
              </p>
              <p className="mt-1 text-xs">{s.nameEn}</p>
            </div>
          </div>
          <p className="mt-4 text-sm leading-7">{s.tagline}</p>
          <dl className="mt-5 space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Eye className="size-4 text-gold" aria-hidden />
              <dt>{t("footer.totalVisits")}</dt>
              <dd className="text-white">{num(s.stats.totalVisits)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Users className="size-4 text-gold" aria-hidden />
              <dt>{t("footer.todayVisits")}</dt>
              <dd className="text-white">{num(s.stats.todayVisits)}</dd>
            </div>
            <div className="flex items-center gap-2">
              <Wifi className="size-4 text-gold" aria-hidden />
              <dt>{t("footer.online")}</dt>
              <dd className="text-white">{num(s.stats.online)}</dd>
            </div>
          </dl>
        </div>

        {/* Links */}
        <nav aria-label="پیوندها">
          <h2 className="font-display text-2xl text-white">
            {t("footer.links")}
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {s.footerLinks.map((l) => (
              <li key={l.title}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 transition-colors hover:text-gold"
                >
                  <Link2 className="size-3.5" aria-hidden />
                  {l.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Useful portals */}
        <nav aria-label="پیوندهای مفید">
          <h2 className="font-display text-2xl text-white">
            {t("footer.usefulLinks")}
          </h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {content.quickLinks.map((l) => (
              <li key={l.id}>
                <a
                  href={l.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 transition-colors hover:text-gold"
                >
                  <Link2 className="size-3.5" aria-hidden />
                  {l.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Contact */}
        <div>
          <h2 className="font-display text-2xl text-white">
            {t("footer.contact")}
          </h2>
          <address className="mt-4 space-y-3 text-sm not-italic leading-7">
            <p className="flex gap-2">
              <MapPin className="mt-1 size-4 shrink-0 text-gold" aria-hidden />
              {s.address}
            </p>
            <p className="flex items-center gap-2" dir="ltr">
              <Phone className="size-4 shrink-0 text-gold" aria-hidden />
              <span className="space-x-2">
                {s.phones.map((p) => (
                  <a key={p} href={`tel:${p}`} className="hover:text-gold">
                    {p}
                  </a>
                ))}
              </span>
            </p>
            <p className="flex items-center gap-2">
              <Mail className="size-4 shrink-0 text-gold" aria-hidden />
              {t("footer.postal")}: {s.postalCode}
            </p>
          </address>
          {/* before:-inset-1.5 grows each icon's tap target from 32px to 44px
              without changing its rendered size; the gap-3 spacing means the two
              expanded areas meet exactly and never overlap. */}
          <div className="mt-5 flex items-center gap-3">
            <span className="text-sm">{t("footer.socials")}</span>
            <a
              href={s.telegram}
              target="_blank"
              rel="noreferrer"
              aria-label="تلگرام"
              className="relative rounded-lg bg-white/10 p-2 transition-colors hover:bg-copper hover:text-white before:absolute before:-inset-1.5 before:content-['']"
            >
              <Send className="size-4" />
            </a>
            <a
              href={s.instagram}
              target="_blank"
              rel="noreferrer"
              aria-label="اینستاگرام"
              className="relative rounded-lg bg-white/10 p-2 transition-colors hover:bg-copper hover:text-white before:absolute before:-inset-1.5 before:content-['']"
            >
              <AtSign className="size-4" />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-5 text-xs sm:flex-row">
          <p>{t("footer.rights")}</p>
          <div className="flex items-center gap-4">
            <Link href="/p/tamas" className="hover:text-gold">
              {t("footer.privacy")}
            </Link>
            <Link href="/p/tamas" className="hover:text-gold">
              {t("footer.terms")}
            </Link>
            <a
              href="https://landing-panel.myceo.ir"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gold"
            >
              {t("footer.admin")}
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
