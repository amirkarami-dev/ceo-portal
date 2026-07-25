# Frontend: Web (Next.js)

The `<PLACEHOLDER>` web app is **Next.js 16 (App Router)** with **next-intl** for i18n,
Tailwind v4, and a shadcn-style token design system. It lives in `web/` inside the
npm-workspaces monorepo. Auth is **central OIDC SSO via Auth.js v5** (ADR-013): the user
signs in at the IdP and the API receives the OIDC access token as a bearer. The data layer
is **TanStack Query v5 + bounded RSC prefetch** (ADR-016).

```bash
cd web && npm install
npm run dev      # http://localhost:3000
npm run build    # production build — must pass before deploy
npm run lint
```

`web/.env.local` sets `NEXT_PUBLIC_API_BASE` (dev: `http://localhost:5000`). It is baked at
build time. `next.config.ts` keeps `output: "standalone"` (for the Docker image) and
`transpilePackages: ["@<PLACEHOLDER>/assessment-core"]` (the shared TS engine ships as
source — see `shared-package.md`).

---

## 1. App Router structure under `app/[locale]`

Everything is nested under a `[locale]` segment so URLs can carry the language. The real
`<html lang/dir>` and all the providers live in `app/[locale]/layout.tsx`:

```tsx
const dir = locale === "fa" ? "rtl" : "ltr"
return (
  <html lang={locale} dir={dir} suppressHydrationWarning>
    <body>
      <script dangerouslySetInnerHTML={{ __html: themeNoFlashScript }} />
      <NextIntlClientProvider messages={messages}>
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </NextIntlClientProvider>
    </body>
  </html>
)
```

`generateStaticParams()` returns `routing.locales`, and an invalid locale → `notFound()`.

### Route groups
```
app/[locale]/
  page.tsx              ← root "/" = PUBLIC landing page (components/landing/*)
  (auth)/               ← PUBLIC: login (→ redirect to IdP), auth/callback
  (dashboard)/          ← PROTECTED: Server-Component layout seeds identity; sidebar + topbar shell
    layout.tsx          ← Server Component: auth() → <AuthProvider initialUser>
    dashboard/  projects/  projects/[id]/  import/  subscription/
    admin/layout.tsx      ← Server Component role gate (auth() → require Administrator)
    admin/users/          ← admin-only (gated by the admin layout, not a client check)
```

- Route groups `(auth)` / `(dashboard)` organize layout without adding URL segments.
- **Auth boundary lives on the SERVER** (in-flight on `feat/server-auth-ssr` — deployed to
  production for owner testing, **not yet merged**; ADR-017). The dashboard layout
  (`(dashboard)/layout.tsx`) is a **Server Component**: it resolves identity via `auth()`
  and seeds `<AuthProvider initialUser>`, then renders the sidebar/topbar. There is **no
  client `<RequireAuth>`** — route protection is a **session-cookie presence gate in
  `middleware.ts`** (locale-aware redirect to `/login`).
- The `/admin` area is gated by its own **Server Component layout**
  (`(dashboard)/admin/layout.tsx`), which re-checks the role via `auth()` server-side. The
  cookie-presence middleware is a UX gate; real validation stays at the API JWT layer + the
  RSC `auth()` checks.

---

## 2. i18n with next-intl (fa default RTL + en)

Config lives in `web/src/i18n/`:

```ts
// routing.ts
export const routing = defineRouting({
  locales: ["fa", "en"],
  defaultLocale: "fa",
  localePrefix: "as-needed",   // fa served at "/", en at "/en/..."
  localeDetection: false,      // never auto-switch on Accept-Language; everyone gets fa
})
```

- **`localePrefix: "as-needed"`** → the default locale (`fa`) has **no** URL prefix; `en`
  is served at `/en/...`.
- **`localeDetection: false`** → the browser language is ignored; users always land on `fa`
  and reach `en` only by navigating to it.
- `request.ts` loads messages from `messages/{locale}.json`. `navigation.ts` exports the
  locale-aware `Link`, `redirect`, `usePathname`, `useRouter`, `getPathname`.

### Using it
- Read strings with `useTranslations("namespace")` (client) /
  `getTranslations` (server). Server pages call `setRequestLocale(locale)` first (the
  layout does this).
- **Always import `Link` / `useRouter` from `@/i18n/navigation`**, never `next/link` /
  `next/navigation` — otherwise the `/en` prefix is dropped and locale-aware nav breaks.
- Add a key to **both** `messages/fa.json` and `messages/en.json` when you add a string.

See `i18n-rtl.md` for the RTL/font details.

---

## 3. The `lib/` API layer

All network + auth code is in `web/src/lib/`:

| File | Role |
|---|---|
| `env.ts` | Reads `NEXT_PUBLIC_API_BASE` once; warns (prod) and falls back to `localhost:5000`. |
| `api.ts` | `apiFetch<T>()` — fetch wrapper: attaches the OIDC access token from the Auth.js session (`getSession()`), throws typed `ApiError`. Also drives the top loading bar (§7). |
| `api-server.ts` | Server-side fetch used by RSC prefetch — reads the access token from `auth()` and warms the TanStack Query cache via `HydrationBoundary`. |
| `endpoints.ts` | Grouped API calls: `projectsApi`, `subscriptionApi`, `adminApi`. (No `authApi` — login lives in the IdP.) |
| `auth-context.tsx` | `<AuthProvider initialUser>` + `useAuth()` exposing `{ user, roles, isAdmin, ready, logout }`. Identity is **seeded server-side**; it does **not** call `GET /api/Users/me`. |
| `types.ts` | Shared request/response TypeScript types. |

> **`lib/tokens.ts` is gone** — there is no `localStorage` token store. The httpOnly Auth.js
> session cookie holds the OIDC tokens; the client reads the access token via `getSession()`.

### `apiFetch` (fetch + OIDC bearer)
- Attaches `Authorization: Bearer <access>` from the Auth.js session (`getSession()`).
- The OIDC access token has a 30-min lifetime; on expiry the user is redirected to re-auth
  at the IdP (silent refresh rotation is a tracked deferred follow-up — ADR-017).
- Throws `ApiError(status, message, body)` on non-2xx; returns `undefined` for 204/empty.

```ts
// endpoints.ts — declare calls here, not inline in components
export const projectsApi = {
  list: () => apiFetch<Project[]>("/api/Projects"),
  create: (input: CreateProjectInput) =>
    apiFetch<{ id: string }>("/api/Projects", { method: "POST", body: input }),
  remove: (id: string) => apiFetch(`/api/Projects/${id}`, { method: "DELETE" }),
}
```

### Auth context
`useAuth()` gives `{ user, roles, isAdmin, ready, logout }` — **no** `setTokens`,
`refreshUser`, or `isAuthenticated`. `<AuthProvider initialUser>` is **seeded server-side**
from the dashboard layout's `auth()` call; it does **not** call `GET /api/Users/me` on
mount. Gate admin **UI** cosmetically on `isAdmin`; route protection itself is enforced by
the `middleware.ts` cookie gate and the server `(dashboard)/admin/layout.tsx` role gate —
the old client `<RequireAuth>` is removed.

This server-auth model is in-flight on `feat/server-auth-ssr` (ADR-017): deployed to
production for owner testing, not yet merged. See `sso-oidc.md` for the SSO design/contract
and `auth-and-roles.md` for the (historical) single-service bearer model.

---

## 4. Design tokens in `globals.css` (emerald, dark mode, RTL)

`web/src/app/globals.css` defines the whole design system with CSS variables (shadcn-style,
OKLCH). Key points:

- **Primary is emerald** (`--primary: oklch(0.627 0.149 162.5)`), surfaced to Tailwind via
  `@theme inline { --color-primary: var(--primary); ... }`.
- **Dark mode** uses a `.dark` class (toggled by `components/theme-provider.tsx`, with a
  no-flash inline script in the layout). `:root` = light, `.dark` = dark overrides.
- **Fonts**: Vazirmatn (Persian) imported from `@fontsource/vazirmatn` and set as
  `--font-sans`.
- **Logical properties for RTL**: components use `start`/`end` utilities (`ms-`, `me-`,
  `inset-inline-start`) so the same classes flip correctly between `dir="rtl"` and `ltr`.
  A `.flip-x` helper mirrors icons under `[dir="rtl"]`.

### The dark-mode compatibility layer (don't delete it)
Several components were ported from a legacy app with **hardcoded** `slate-*` / `white` /
`brand-*` Tailwind classes that do not adapt to dark mode (dark text on a dark surface, blue
brand text). `globals.css` remaps the ones actually in use to theme tokens, **only under
`.dark`**, so light mode is untouched:

```css
.dark .text-slate-900, .dark .text-slate-800, .dark .text-slate-700, .dark .text-slate-600 { color: var(--foreground); }
.dark .text-brand-700, .dark .text-brand-800 { color: var(--primary); }
.dark .bg-white { background-color: var(--card); }
.dark .bg-brand-50 { background-color: color-mix(in oklch, var(--primary) 15%, transparent); }
```

The two-class `.dark .text-*` selector outranks Tailwind's single-class utility, so no
`!important` is needed. There is also a legacy `brand-*` palette (`--color-brand-50..900`)
mapped to the emerald primary so old `text-brand-*` utilities render emerald, not blue.

**Prefer token utilities** (`text-foreground`, `bg-card`, `text-primary`) in new code.
Only rely on the compat layer for code you are porting verbatim.

---

## 5. Keep `components/ui` stable

Shared UI primitives live in `web/src/components/ui` and are imported **everywhere** via the
barrel `@/components/ui` (e.g. `Button`, `Card`, `Field`, `Spinner`, `cn`). The hard rule:

> **Keep the export surface stable — restyle, don't rename.**

You may freely change a primitive's styling/tokens, but do not rename or remove an export,
and do not change its public props, or you break every page at once. Add new primitives
rather than repurposing existing ones, and re-export them from the barrel.

---

## 6. Recipe: add a protected dashboard page

1. Create `app/[locale]/(dashboard)/widgets/page.tsx` (auto-protected by the
   `middleware.ts` cookie gate + the server dashboard layout, and it gets the
   sidebar/topbar shell).
2. Add an API group method in `lib/endpoints.ts` (e.g. `widgetsApi.list()`), with response
   types in `lib/types.ts`.
3. Read with a TanStack Query hook (`useQuery`) over the endpoint; write with `useMutation`
   that invalidates the relevant keys. For SSR-first pages, prefetch in the RSC via
   `lib/api-server.ts` + `HydrationBoundary`. Handle `ApiError` (read `body.errors` for 400
   field errors).
4. Use `useTranslations(...)` for all strings and `@/i18n/navigation` for links.
5. Build UI from `@/components/ui` primitives and token utility classes.
6. For admin-only UI, render conditionally on `useAuth().isAdmin` (cosmetic — the real gate
   is the server `admin/layout.tsx`).

## 7. Global loading feedback (top progress bar)

Give the user immediate, app-wide feedback whenever the app is "busy" — navigating to
the next page, reloading, or waiting for data — with a single modern top progress bar
(NProgress-style). It is dependency-free and driven by **both** navigation and API
activity, so individual pages don't have to wire anything up.

Three small pieces:

1. **`lib/loading.ts`** — a tiny module-level store that counts in-flight work and lets
   components subscribe to active/idle changes:
   - `beginLoading()` / `endLoading()` (increment/decrement a counter; emit only on the
     0↔1 edges), `isLoading()`, and `subscribeLoading(listener) → unsubscribe`.
   - No dependencies, SSR-safe (just module state + a `Set` of listeners).
2. **`lib/api.ts`** — the central `apiFetch` wrapper calls `beginLoading()` on entry and
   `endLoading()` in a `finally`, so **every** data request drives the bar automatically.
   Keep the request work in an inner function (`apiFetchInner`) so the public wrapper
   counts each top-level call exactly once.
3. **`components/top-loading-bar.tsx`** (`"use client"`) — a fixed, thin bar at the top:
   - Subscribes to `subscribeLoading` (reflects in-flight API requests).
   - Also pulses briefly on every route change (effect on `usePathname()`), which covers
     navigations that fetch no data. (Avoid `useSearchParams()` here — it would force a
     Suspense boundary; `usePathname` doesn't.)
   - Eases toward ~90% while busy, jumps to 100% and fades out when idle.
   - Styled with `background: var(--primary)` (emerald) so it adapts to light/dark, and
     uses `insetInlineStart/End` so it fills correctly under RTL. Renders `null` until
     active (no hydration mismatch).

Mount it **once** in `app/[locale]/layout.tsx`, inside `ThemeProvider`:

```tsx
<ThemeProvider>
  <TopLoadingBar />
  <AuthProvider>{children}</AuthProvider>
</ThemeProvider>
```

Per-control feedback (a clicked button/link showing a spinner) stays the responsibility of
the `@/components/ui` `Button` (`loading`/`disabled` props) — the top bar is the global
signal; the button state is the local one. Together they cover "go to next page", "reload",
"waiting for data", and "I clicked something".
