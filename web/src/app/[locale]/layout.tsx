import type { ReactNode } from "react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { NextIntlClientProvider, hasLocale } from "next-intl"
import { getMessages, setRequestLocale } from "next-intl/server"
import { SessionProvider } from "next-auth/react"
import { routing } from "@/i18n/routing"
import { QueryProvider } from "@/components/query-provider"
import { ThemeProvider, themeNoFlashScript } from "@/components/theme-provider"
import { TopLoadingBar } from "@/components/top-loading-bar"
import "../globals.css"

export const metadata: Metadata = {
  title: "سامانه مبحث ۱۹ | Mabhas19",
  description: "ارزیابی جامع انرژی ساختمان بر اساس مبحث ۱۹ مقررات ملی ساختمان",
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()

  setRequestLocale(locale)
  const messages = await getMessages()
  const dir = locale === "fa" ? "rtl" : "ltr"

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        {/* Rendered by this Server Component into <head>: the HTML parser runs it
            synchronously before first paint (no FOUC, incl. hard reload), and React
            does not re-materialize it during client reconciliation (no "script tag
            while rendering React component" warning). */}
        <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <SessionProvider>
          <QueryProvider>
            <NextIntlClientProvider messages={messages}>
              <ThemeProvider>
                <TopLoadingBar />
                {children}
              </ThemeProvider>
            </NextIntlClientProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  )
}
