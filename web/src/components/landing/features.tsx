"use client"

import { useLocale } from "next-intl"
import { Card, CardBody } from "@/components/ui"
import type { ReactNode } from "react"

function Icon({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-5">
        {children}
      </svg>
    </span>
  )
}

export function Features() {
  const locale = useLocale()
  const fa = locale === "fa"

  const features: Array<{ title: string; desc: string; icon: ReactNode }> = [
    {
      title: fa ? "محاسبه پوسته و تأسیسات" : "Envelope & systems calc",
      desc: fa
        ? "ارزیابی دقیق ضرایب حرارتی پوسته و عملکرد تأسیسات مکانیکی و الکتریکی."
        : "Accurate thermal coefficients for the envelope plus mechanical and electrical systems.",
      icon: <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4" />,
    },
    {
      title: fa ? "پهنه‌بندی اقلیمی" : "Climate zoning",
      desc: fa
        ? "تعیین خودکار پهنه اقلیمی پروژه میان ۶ پهنه آب‌وهوایی کشور."
        : "Automatic determination of the project climate zone across 6 regions.",
      icon: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18z" /></>,
    },
    {
      title: fa ? "مدیریت پروژه‌ها" : "Project management",
      desc: fa
        ? "همه پروژه‌ها در یک داشبورد؛ ایجاد، ویرایش و پیگیری وضعیت آن‌ها."
        : "All your projects in one dashboard — create, edit, and track their status.",
      icon: <><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M8 14h8" /></>,
    },
    {
      title: fa ? "خروجی PDF فارسی" : "Persian PDF export",
      desc: fa
        ? "تولید گزارش رسمی و قابل ارائه با چیدمان راست‌به‌چپ و فونت فارسی."
        : "Generate official, presentable reports with RTL layout and Persian fonts.",
      icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /></>,
    },
    {
      title: fa ? "ورود از نظام مهندسی" : "Engineering org login",
      desc: fa
        ? "احراز هویت یکپارچه از طریق سامانه نظام مهندسی ساختمان."
        : "Single sign-on through the building engineering organization system.",
      icon: <><path d="M12 2 3 7v6c0 5 3.8 8.5 9 9 5.2-.5 9-4 9-9V7z" /><path d="m9 12 2 2 4-4" /></>,
    },
    {
      title: fa ? "ورود با موبایل / گوگل" : "Mobile / Google login",
      desc: fa
        ? "ورود سریع با شماره موبایل یا حساب گوگل، بدون فرم‌های طولانی."
        : "Quick sign-in with your phone number or Google account, no long forms.",
      icon: <><rect x="7" y="2" width="10" height="20" rx="2" /><path d="M11 18h2" /></>,
    },
  ]

  return (
    <section id="features" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 md:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
            {fa ? "همه‌چیز برای ارزیابی مبحث ۱۹" : "Everything for Section 19 assessment"}
          </h2>
          <p className="mt-4 text-muted-foreground">
            {fa
              ? "ابزارهای کامل برای محاسبه، مدیریت و گزارش‌گیری انرژی ساختمان در یک‌جا."
              : "A complete toolset to calculate, manage, and report building energy in one place."}
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} className="rounded-2xl transition-shadow hover:shadow-md">
              <CardBody className="text-start">
                <Icon>{f.icon}</Icon>
                <h3 className="mt-4 text-lg font-semibold text-foreground">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
