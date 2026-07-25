"use client"

import { useLocale } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Button } from "@/components/ui"
import { Logo } from "./logo"

export function CtaFooter() {
  const locale = useLocale()
  const fa = locale === "fa"

  const footerLinks: Array<{ href: string; label: string }> = [
    { href: "#features", label: fa ? "امکانات" : "Features" },
    { href: "#how", label: fa ? "نحوه کار" : "How it works" },
    { href: "#faq", label: fa ? "سوالات متداول" : "FAQ" },
  ]

  return (
    <>
      {/* Final CTA band */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-4 py-16 text-center sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {fa ? "همین امروز ارزیابی را شروع کنید" : "Start your assessment today"}
          </h2>
          <p className="max-w-xl text-primary-foreground/85">
            {fa
              ? "ارزیابی رایگان، خروجی PDF فارسی و تمام چک‌لیست‌های تخصصی مبحث ۱۹."
              : "Free assessments, Persian PDF export, and all of Section 19's expert checklists."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href="/login">
              <Button size="lg" variant="secondary" className="bg-background text-foreground hover:bg-background/90">
                {fa ? "شروع کنید" : "Get started"}
              </Button>
            </Link>
            <Link href="/login">
              <Button
                size="lg"
                variant="outline"
                className="border-primary-foreground/40 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                {fa ? "ورود" : "Login"}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-background">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
            <div className="max-w-xs">
              <Logo />
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {fa
                  ? "پلتفرم ارزیابی جامع انرژی ساختمان مطابق مبحث ۱۹ مقررات ملی ساختمان."
                  : "Comprehensive building energy assessment platform compliant with Section 19."}
              </p>
            </div>
            <nav className="flex flex-wrap gap-x-8 gap-y-3">
              {footerLinks.map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {l.label}
                </a>
              ))}
              <Link
                href="/login"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {fa ? "ورود" : "Login"}
              </Link>
            </nav>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 text-sm text-muted-foreground sm:flex-row">
            <span>{fa ? "© ۱۴۰۵ مبحث ۱۹" : "© 2026 Mabhas19"}</span>
            <a
              href="https://mabhas19.myceo.ir"
              className="transition-colors hover:text-foreground"
            >
              mabhas19.myceo.ir
            </a>
          </div>
        </div>
      </footer>
    </>
  )
}
