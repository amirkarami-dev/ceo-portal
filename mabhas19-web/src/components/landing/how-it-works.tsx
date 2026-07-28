"use client"

import { useLocale } from "next-intl"

export function HowItWorks() {
  const locale = useLocale()
  const fa = locale === "fa"

  const steps = [
    {
      n: fa ? "۱" : "1",
      title: fa ? "ثبت‌نام" : "Sign up",
      desc: fa ? "حساب کاربری خود را در چند ثانیه بسازید." : "Create your account in seconds.",
    },
    {
      n: fa ? "۲" : "2",
      title: fa ? "ایجاد پروژه" : "Create a project",
      desc: fa ? "اطلاعات ساختمان و پهنه اقلیمی را وارد کنید." : "Enter building info and climate zone.",
    },
    {
      n: fa ? "۳" : "3",
      title: fa ? "تکمیل چک‌لیست‌ها" : "Complete checklists",
      desc: fa ? "چک‌لیست‌های پوسته و تأسیسات را پر کنید." : "Fill out envelope and systems checklists.",
    },
    {
      n: fa ? "۴" : "4",
      title: fa ? "دریافت گزارش PDF" : "Get the PDF report",
      desc: fa ? "گزارش رسمی فارسی را دانلود کنید." : "Download your official Persian report.",
    },
  ]

  return (
    <section id="how" className="scroll-mt-20 bg-muted/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {fa ? "چطور کار می‌کند؟" : "How it works"}
          </h2>
          <p className="mt-4 text-muted-foreground">
            {fa ? "از ثبت‌نام تا گزارش نهایی، تنها چهار قدم." : "From sign-up to final report in just four steps."}
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div
              key={s.title}
              className="relative rounded-2xl border border-border bg-card p-6 text-start shadow-sm"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
                {s.n}
              </span>
              <h3 className="mt-4 text-base font-semibold text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
