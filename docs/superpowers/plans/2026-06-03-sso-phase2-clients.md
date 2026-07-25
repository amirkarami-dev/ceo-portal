# SSO Phase 2 — Web (Auth.js) + Mobile (expo-auth-session) OIDC clients

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use `- [ ]`.
> **Depends on:** the **frozen** token contract in `plan_development/01-development/sso-oidc.md` §4 (do not change it). Phase 1 (IdP + resource server) is complete; 40/40 tests green.

**Goal:** Convert the `mabhas19` web (Next.js) and mobile (Expo) apps from local bearer-token auth to OIDC clients of `auth.myceo.ir`, so login happens at the IdP and a single account works across services.

**Architecture:** Web uses **Auth.js (NextAuth v5)** as a generic OIDC client (code+PKCE); the IdP-issued **access token is surfaced on the Auth.js session** and attached by the existing `apiFetch`. Mobile uses **expo-auth-session** (code+PKCE), storing tokens in SecureStore. Both replace their password/OTP/Google screens with a single "Sign in" that redirects to the IdP (which owns those methods).

**Tech Stack:** next-auth@5 (beta/v5), Next 16, React 19; expo-auth-session, expo-web-browser, expo-secure-store, Expo SDK 54.

**Decisions (baked in):**
- D-P2-1: Access token exposed via Auth.js session (`session.accessToken`) for client-side `apiFetch`. (BFF proxy = future hardening.)
- D-P2-2: IdP owns login UI. Web `login` page → `signIn("mabhas19")`; **web `register` page and client Google JS removed**; OTP/Google auto-create users at the IdP.
- D-P2-3: Local dev: IdP `http://localhost:5100`, web `http://localhost:3000`, API `http://localhost:5000`. Client secret for `mabhas19-web` = the IdP's seeded dev secret `dev-web-secret`.

**Verification reality:** build/lint/typecheck gate automatically. The full redirect login flow is verified by a **manual run** (web against the locally-running IdP + API) since headless OIDC E2E needs a browser. Each task lists its check.

---

## File structure (Phase 2)

**Web — create:**
- `web/src/auth.ts` — NextAuth config (OIDC provider, callbacks exposing accessToken)
- `web/src/app/api/auth/[...nextauth]/route.ts` — Auth.js route handlers
- `web/src/app/[locale]/(auth)/login/page.tsx` — replaced with a "Sign in" button (`signIn`)
**Web — modify:**
- `web/package.json` — add `next-auth@^5`
- `web/src/lib/auth-context.tsx` — back `useAuth()` by `useSession()` (keep the same public shape: `user`, `isAdmin`, `ready`/`isAuthenticated`, `logout`)
- `web/src/lib/api.ts` — attach bearer from the Auth.js session (not localStorage); on 401 trigger `signIn`/refresh
- `web/src/lib/endpoints.ts` — drop `authApi` login/register/refresh/otp/google (keep `me`); keep project/subscription/admin APIs
- `web/src/components/require-auth.tsx` — gate on session status
- `web/src/app/[locale]/layout.tsx` — wrap in `SessionProvider`
- `web/src/middleware.ts` — compose next-intl with Auth.js route protection
- `web/.env.local` / `.env.example` — `AUTH_SECRET`, `AUTH_MABHAS19_ISSUER`, `AUTH_MABHAS19_ID`, `AUTH_MABHAS19_SECRET`
**Web — delete:**
- `web/src/lib/tokens.ts`, `web/src/app/[locale]/(auth)/register/page.tsx`, `web/src/app/[locale]/auth/callback/page.tsx`

**Mobile — create:**
- `mobile/src/lib/oidc.ts` — expo-auth-session discovery + request config + token exchange/refresh
**Mobile — modify:**
- `mobile/package.json` — add `expo-auth-session`
- `mobile/src/lib/auth-context.tsx` — `signIn()` via `promptAsync`, store tokens, `me()`, `logout`
- `mobile/src/lib/tokens.ts` — keep (store OIDC access+refresh)
- `mobile/src/lib/api.ts` — refresh via the IdP token endpoint (not `/api/Users/refresh`)
- `mobile/src/lib/endpoints.ts` — drop authApi login/otp/google (keep `me`)
- `mobile/app/login.tsx` — single "Sign in" button → `signIn()`
- `mobile/app.json` — confirm scheme `mabhas19` + redirect path

---

## Task C1: Add Auth.js + OIDC provider config (web)

**Files:** `web/package.json`, `web/src/auth.ts`, `web/src/app/api/auth/[...nextauth]/route.ts`, `web/.env.local`, `web/.env.example`

- [ ] **Step 1: Install** — `npm install next-auth@beta -w web` (NextAuth v5). Record the resolved version.
- [ ] **Step 2: `web/src/auth.ts`:**
```ts
import NextAuth from "next-auth"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    {
      id: "mabhas19",
      name: "Mabhas19",
      type: "oidc",
      issuer: process.env.AUTH_MABHAS19_ISSUER,        // http://localhost:5100 (dev) / https://auth.myceo.ir
      clientId: process.env.AUTH_MABHAS19_ID,           // mabhas19-web
      clientSecret: process.env.AUTH_MABHAS19_SECRET,   // dev-web-secret
      authorization: { params: { scope: "openid profile email roles offline_access mabhas19.api" } },
    },
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
        token.expiresAt = account.expires_at
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string | undefined
      return session
    },
  },
})
```
- [ ] **Step 3: route handler** `web/src/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from "@/auth"
export const { GET, POST } = handlers
```
- [ ] **Step 4: env** — add to `web/.env.local`:
```
AUTH_SECRET=dev-only-change-me
AUTH_MABHAS19_ISSUER=http://localhost:5100
AUTH_MABHAS19_ID=mabhas19-web
AUTH_MABHAS19_SECRET=dev-web-secret
```
and document the same keys (empty) in `.env.example`.
- [ ] **Step 5: type augmentation** — add `web/src/types/next-auth.d.ts` declaring `session.accessToken?: string` and `token.accessToken/refreshToken/expiresAt`.
- [ ] **Step 6:** `npm run build -w web` — must pass (env can be absent at build; the provider reads at runtime). Commit:
```
git add web/package.json web/package-lock.json web/src/auth.ts "web/src/app/api/auth/[...nextauth]/route.ts" web/src/types/next-auth.d.ts web/.env.example
git commit -m "feat(web): add Auth.js OIDC client for auth.myceo.ir"
```

## Task C2: SessionProvider + useAuth over useSession (web)

**Files:** `web/src/app/[locale]/layout.tsx`, `web/src/lib/auth-context.tsx`

- [ ] **Step 1:** wrap the app in `<SessionProvider>` (from `next-auth/react`) inside `layout.tsx`, around the existing providers.
- [ ] **Step 2:** rewrite `auth-context.tsx` so `useAuth()` keeps the SAME public shape used across the app, backed by `useSession()`:
  - `ready` = `status !== "loading"`, `isAuthenticated` = `status === "authenticated"`.
  - `user`/`isAdmin`/`roles` = from `authApi.me()` (fetch once when authenticated, using the session token) — reuse the existing `CurrentUser` type. (`/api/Users/me` is still served by the API.)
  - `logout()` = `signOut()` + IdP end-session (redirect to `${issuer}/connect/logout`).
- [ ] **Step 3:** `npm run build -w web` + `npm run lint -w web` (lint may carry the pre-existing set-state-in-effect items; no NEW errors). Commit.

## Task C3: Token attach + endpoints cleanup (web)

**Files:** `web/src/lib/api.ts`, `web/src/lib/endpoints.ts`, delete `web/src/lib/tokens.ts`

- [ ] **Step 1:** `api.ts` — get the access token from the Auth.js session. Since `apiFetch` runs client-side, read it via `getSession()` (from `next-auth/react`) or accept a token argument from callers using `useSession()`. On 401, call `signIn("mabhas19")` (session/refresh expired). Remove the `doRefresh()`/`/api/Users/refresh` logic and the `tokenStore` import.
- [ ] **Step 2:** `endpoints.ts` — remove `authApi.login/register/logout/refresh/requestOtp/verifyOtp/google` and `saveTokens`. Keep `authApi.me()` and the `projectsApi`/`subscriptionApi`/`adminApi` groups.
- [ ] **Step 3:** delete `web/src/lib/tokens.ts`; fix any remaining imports.
- [ ] **Step 4:** `npm run build -w web` — pass. Commit.

## Task C4: Login page → IdP redirect; remove register/callback (web)

**Files:** `web/src/app/[locale]/(auth)/login/page.tsx`; delete `register/page.tsx`, `auth/callback/page.tsx`

- [ ] **Step 1:** replace the login page body with a single primary action calling `signIn("mabhas19", { callbackUrl: "/dashboard" })` (Persian "ورود / ثبت‌نام", RTL). Remove the password/OTP/Google forms + the Google GSI script.
- [ ] **Step 2:** delete `register/page.tsx` and `auth/callback/page.tsx`; remove links to `/register` (e.g., in the landing/navbar) — grep and fix.
- [ ] **Step 3:** `npm run build -w web` — pass (no broken imports/links). Commit.

## Task C5: Route protection + manual flow verification (web)

**Files:** `web/src/middleware.ts`, `web/src/components/require-auth.tsx`

- [ ] **Step 1:** keep `RequireAuth` gating dashboard routes on session status (redirect to `/login`). Optionally add Auth.js protection in `middleware.ts` composed with the next-intl middleware (next-intl must run; Auth.js check layered for dashboard paths). Keep it simple — `RequireAuth` already guards; middleware change optional.
- [ ] **Step 2 (manual gate):** with the IdP (`:5100`) + API (`:5000`) running locally, `npm run dev -w web`, open `/`, click sign in → redirected to the IdP login → after login, back at `/dashboard` authenticated; a dashboard API call (`/api/Projects`) succeeds with the session's bearer. Document the result. Commit any fixes.

## Task D1: Add expo-auth-session OIDC (mobile)

**Files:** `mobile/package.json`, `mobile/src/lib/oidc.ts`, `mobile/app.json`

- [ ] **Step 1:** `npx expo install expo-auth-session expo-crypto -w mobile` (or per Expo SDK 54). Record versions.
- [ ] **Step 2:** `mobile/src/lib/oidc.ts` — discovery via `useAutoDiscovery(issuer)`; `AuthRequest` with `clientId: "mabhas19-mobile"`, `scopes: ["openid","profile","email","roles","offline_access","mabhas19.api"]`, `redirectUri: makeRedirectUri({ scheme: "mabhas19", path: "auth" })`, PKCE on; helper to exchange the code (`exchangeCodeAsync`) and to refresh (`refreshAsync`) against the discovery token endpoint. Issuer from `EXPO_PUBLIC_AUTH_ISSUER` / `app.json` extra.
- [ ] **Step 3:** confirm `app.json` scheme `mabhas19` and redirect `mabhas19://auth` matches the seeded `mabhas19-mobile` client. Build/typecheck: `npx tsc -p mobile --noEmit`. Commit.

## Task D2: Auth context + token storage + api refresh (mobile)

**Files:** `mobile/src/lib/auth-context.tsx`, `mobile/src/lib/tokens.ts`, `mobile/src/lib/api.ts`, `mobile/src/lib/endpoints.ts`

- [ ] **Step 1:** `auth-context.tsx` — replace `loginWithPassword/Otp/Google` with a single `signIn()` that runs `promptAsync()` → exchanges the code → stores access+refresh in SecureStore (`tokenStore.set`) → `refreshUser()` (`/api/Users/me`). Keep `user`, `isAdmin`, `loading`, `logout` (clear tokens + optional IdP end-session).
- [ ] **Step 2:** `tokens.ts` — keep as-is (stores access+refresh).
- [ ] **Step 3:** `api.ts` — on 401, refresh via the IdP token endpoint (`refreshAsync`) instead of `/api/Users/refresh`; update the stored tokens.
- [ ] **Step 4:** `endpoints.ts` — remove `authApi.login/requestOtp/verifyOtp/google` (keep `me`).
- [ ] **Step 5:** `npx tsc -p mobile --noEmit` — pass. Commit.

## Task D3: Login screen + gating (mobile)

**Files:** `mobile/app/login.tsx`, `mobile/app/index.tsx`, `mobile/app/(app)/_layout.tsx`

- [ ] **Step 1:** `login.tsx` — single "ورود با حساب مبحث۱۹" button calling `signIn()`; remove password/OTP UI. Show `loading`.
- [ ] **Step 2:** keep `index.tsx` / `(app)/_layout.tsx` gating on `user`/`loading` (unchanged semantics).
- [ ] **Step 3:** `npx tsc -p mobile --noEmit` — pass. (Full device flow verified manually later.) Commit.

---

## Phase 2 exit gate
- [ ] `npm run build -w web` passes; web login redirects to IdP and returns authenticated (manual run); API calls carry the bearer.
- [ ] `npx tsc -p mobile --noEmit` passes; mobile `signIn()` wired to expo-auth-session against the IdP.
- [ ] No references remain to the removed local-auth endpoints/`tokens.ts`/register/callback.

## Self-review notes
- Spec coverage: C1–C5 = §5-C (web Auth.js); D1–D3 = §5-D (mobile expo-auth-session). Contract §4 unchanged (consumed, not modified).
- Decisions D-P2-1/2/3 recorded above; BFF hardening + IdP self-registration UI are explicit follow-ups (not this pass).
- Verification: build/lint/typecheck automated; redirect flow is a documented manual gate (headless OIDC E2E out of scope).
