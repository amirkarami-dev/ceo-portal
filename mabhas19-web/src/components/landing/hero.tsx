"use client"

import { useLocale } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Button, Card, CardBody, Badge } from "@/components/ui"

export function Hero() {
  const locale = useLocale()
  const fa = locale === "fa"

  return (
    <section className="relative overflow-hidden">
      {/* emerald radial / gradient background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, color-mix(in oklch, var(--primary) 18%, transparent) 0%, transparent 70%)",
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-2">
        <div className="text-start">
          <div className="mb-4">
            <Badge tone="brand">
              {fa ? "پیوست ۵ — ویرایش پنجم" : "Appendix 5 — 5th Edition"}
            </Badge>
          </div>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-foreground sm:text-5xl">
            {fa ? (
              <>
                ارزیابی جامع انرژی ساختمان
                <span className="block text-primary">مبحث ۱۹</span>
              </>
            ) : (
              <>
                Comprehensive Building Energy
                <span className="block text-primary">Assessment — Section 19</span>
              </>
            )}
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground">
            {fa
              ? "ارزیابی پوسته و تأسیسات، پهنه‌بندی اقلیمی و تولید گزارش رسمی PDF فارسی — همه در یک پلتفرم ساده و سریع، مطابق مبحث ۱۹ مقررات ملی ساختمان."
              : "Assess building envelope and systems, climate zoning, and generate official Persian PDF reports — all in one fast, simple platform compliant with Section 19 of Iran's building code."}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link href="/login">
              <Button size="lg">{fa ? "شروع کنید" : "Get started"}</Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline">
                {fa ? "ورود" : "Login"}
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            {fa ? "استفادهٔ رایگان، بدون نیاز به کارت بانکی." : "Free to use, no credit card required."}
          </p>
        </div>

        {/* mock dashboard preview */}
        <div className="relative">
          <Card className="rounded-2xl shadow-lg">
            <CardBody className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">
                  {fa ? "پروژه: ساختمان مسکونی" : "Project: Residential Building"}
                </span>
                <Badge tone="green">{fa ? "تکمیل ۸۲٪" : "82% complete"}</Badge>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full w-[82%] rounded-full bg-primary" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { k: fa ? "پوسته" : "Envelope", v: "۲۴۰" },
                  { k: fa ? "تأسیسات" : "Systems", v: "۳۱۰" },
                  { k: fa ? "روشنایی" : "Lighting", v: "۱۲۰" },
                ].map((s) => (
                  <div
                    key={s.k}
                    className="rounded-xl border border-border bg-background p-3 text-center"
                  >
                    <div className="text-lg font-bold text-primary">{s.v}</div>
                    <div className="text-xs text-muted-foreground">{s.k}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                {[
                  fa ? "محاسبه ضریب انتقال حرارت" : "Heat transfer coefficient",
                  fa ? "پهنه‌بندی اقلیمی منطقه" : "Regional climate zoning",
                  fa ? "تولید گزارش PDF" : "PDF report generation",
                ].map((row, i) => (
                  <div
                    key={row}
                    className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground"
                  >
                    <span
                      className={
                        "inline-flex size-5 items-center justify-center rounded-full " +
                        (i < 2 ? "bg-primary text-primary-foreground" : "bg-muted-foreground/20 text-muted-foreground")
                      }
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="size-3">
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </span>
                    {row}
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </section>
  )
}
