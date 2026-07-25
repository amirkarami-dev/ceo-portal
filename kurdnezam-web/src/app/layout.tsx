import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import type { Content } from "@/data/content";
import { EMPTY_CONTENT, getContent } from "@/lib/api";
import { ContentProvider } from "@/lib/store";
import { I18nProvider } from "@/lib/i18n";

const vazirmatn = localFont({
  src: "../fonts/vazirmatn-variable.woff2",
  weight: "100 900",
  variable: "--font-vazirmatn",
  display: "swap",
});

const iranSans = localFont({
  src: [
    { path: "../fonts/iransans.woff2" },
    { path: "../fonts/iransans.woff" },
  ],
  variable: "--font-iransans",
  display: "swap",
});

const iranSansNumbers = localFont({
  src: [
    { path: "../fonts/iransansnumbers.woff2" },
    { path: "../fonts/iransansnumbers.woff" },
  ],
  variable: "--font-iransans-num",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "سازمان نظام مهندسی ساختمان کردستان",
    template: "%s | سازمان نظام مهندسی ساختمان کردستان",
  },
  description:
    "پایگاه اطلاع‌رسانی سازمان نظام مهندسی ساختمان استان کردستان — اخبار، خدمات مهندسی، عضویت و صدور پروانه",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Server-fetched once per revalidation window (60s) and seeded into the
  // client provider. If the API is down we still render the shell.
  let content: Content;
  try {
    content = await getContent();
  } catch (error) {
    console.error("[kurdnezam] failed to load site content:", error);
    content = EMPTY_CONTENT;
  }

  return (
    <html
      lang="fa"
      dir="rtl"
      className={`${vazirmatn.variable} ${iranSans.variable} ${iranSansNumbers.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ContentProvider initialContent={content}>
          <I18nProvider>{children}</I18nProvider>
        </ContentProvider>
      </body>
    </html>
  );
}
