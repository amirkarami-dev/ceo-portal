# i18n & RTL

`<PLACEHOLDER>` is **Persian-first (fa-IR, RTL)** with English (en-US, LTR) as a secondary
language. The web app uses **next-intl** with full locale routing; the mobile app uses a
tiny dictionary plus React Native's `I18nManager.forceRTL`. Both share an emerald design
language and the Vazirmatn font.

---

## 1. Web — next-intl

### Routing config (`web/src/i18n/routing.ts`)
```ts
export const routing = defineRouting({
  locales: ["fa", "en"],
  defaultLocale: "fa",
  localePrefix: "as-needed",   // fa at "/", en at "/en/..."
  localeDetection: false,      // never auto-switch on Accept-Language
})
```

- `as-needed` → the default locale (`fa`) is served **without** a URL prefix; `en` is at
  `/en/...`.
- `localeDetection: false` → everyone lands on `fa`; `en` only when navigated to.
- `request.ts` loads `messages/{locale}.json`; `navigation.ts` exports locale-aware
  `Link`/`useRouter`/`redirect`.

### `<html lang/dir>` is set in the locale layout
`web/src/app/[locale]/layout.tsx` computes direction from the locale and renders the real
`<html>`:

```tsx
const dir = locale === "fa" ? "rtl" : "ltr"
return (
  <html lang={locale} dir={dir} suppressHydrationWarning>
    <body className="min-h-screen antialiased">
      <NextIntlClientProvider messages={messages}>{/* ThemeProvider + AuthProvider */}</NextIntlClientProvider>
    </body>
  </html>
)
```

Server components call `setRequestLocale(locale)` before reading messages;
`generateStaticParams()` returns `routing.locales`.

### Using strings
- Client: `const t = useTranslations("namespace"); t("key")`.
- Server: `const t = await getTranslations("namespace")`.
- Add every key to **both** `messages/fa.json` and `messages/en.json`.
- **Always** import `Link`/`useRouter` from `@/i18n/navigation` (not `next/*`) so the `/en`
  prefix is preserved.

### Fonts (web)
Vazirmatn is imported in `globals.css` and set as the default sans:

```css
@import "@fontsource/vazirmatn/400.css";
@import "@fontsource/vazirmatn/500.css";
@import "@fontsource/vazirmatn/700.css";
/* in @theme inline: */ --font-sans: "Vazirmatn", ui-sans-serif, system-ui, sans-serif;
```

### RTL with logical CSS properties (the important bit)
Do **not** hardcode `left`/`right`. Use Tailwind **logical** utilities so one set of classes
flips correctly between `dir="rtl"` and `dir="ltr"`:

| Use | Not |
|---|---|
| `ms-*` / `me-*` (margin-inline-start/end) | `ml-*` / `mr-*` |
| `ps-*` / `pe-*` | `pl-*` / `pr-*` |
| `start-*` / `end-*`, `inset-inline-start` | `left-*` / `right-*` |
| `text-start` / `text-end` | `text-left` / `text-right` |
| `border-s` / `border-e` | `border-l` / `border-r` |

The dashboard layout, for example, pins the sidebar with `inset-inline-start: 0` (`start-0`)
and offsets content with `ms-64`, so it sits on the **right** under RTL automatically. For
icons that must visually mirror (arrows, chevrons), use the `.flip-x` helper in
`globals.css` (`[dir="rtl"] .flip-x { transform: scaleX(-1); }`).

> Persian uses Persian/Arabic-Indic digits in display text but the data layer keeps
> ASCII/English numerals; convert at the presentation edge if you need Persian digits.

---

## 2. Mobile — `I18nManager.forceRTL`

React Native is not CSS, so RTL is a global layout mode toggled at startup. The root layout
(`mobile/app/_layout.tsx`) forces it (both at module load and in an effect, since the value
must be set early):

```tsx
import { I18nManager } from "react-native"
import { isRTL } from "@/i18n"

if (isRTL && !I18nManager.isRTL) {
  I18nManager.allowRTL(true)
  I18nManager.forceRTL(true)
}
```

Once forced, RN flips `flexDirection: "row"`, `start`/`end` margins/paddings, and text
alignment automatically — so, as on web, prefer `start`/`end` over `left`/`right` in
styles. For inputs that should stay LTR regardless (email, phone, OTP), set
`textAlign="left"` explicitly (the login screen does this).

`expo-localization` is a plugin in `app.json`. Strings come from a tiny dictionary
(`src/i18n.ts`) with a `t(key)` helper; `locale` is fixed to `fa` (Persian primary), with
`en` as a fallback map:

```ts
export const locale: Locale = "fa"
export const isRTL = locale === "fa"
export function t(key) { return dict[locale][key] ?? dict.fa[key] ?? key }
```

`src/theme.ts` holds the emerald color tokens mirroring the web app.

**Caveat:** `forceRTL` takes full effect after a reload — on a *fresh* install the very
first launch may render LTR until the JS reloads. For production a native restart is
typically triggered after `forceRTL`; for development, reloading the app applies it.

---

## 3. Backend — Persian output

The API stores Persian text as-is (SQL Server `nvarchar` is Unicode) and emits Persian user
messages (e.g. validation errors like `"شماره موبایل الزامی است."`). PDF reports are
rendered right-to-left with a Persian font — see `file-storage-pdf.md`
(`page.ContentFromRightToLeft()` + Vazirmatn registration).

---

## 4. Recipe: add a new UI string

- **Web**: add the key to `messages/fa.json` **and** `messages/en.json`; use
  `t("key")` from `useTranslations`/`getTranslations`.
- **Mobile**: add the key to both `fa` and `en` maps in `src/i18n.ts`; use `t("key")`.
- Lay out with logical properties so it works in both directions; only force `textAlign`
  for fields that must stay LTR.
