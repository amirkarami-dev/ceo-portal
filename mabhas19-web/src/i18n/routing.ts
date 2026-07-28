import { defineRouting } from "next-intl/routing"

export const routing = defineRouting({
  locales: ["fa", "en"],
  defaultLocale: "fa",
  // fa is the default and served at "/" (no prefix); en is served at "/en/...".
  localePrefix: "as-needed",
  // Never auto-switch based on the browser's Accept-Language header; everyone
  // gets fa at "/" by default, and "/en/..." still works when navigated to.
  localeDetection: false,
})

export type Locale = (typeof routing.locales)[number]
