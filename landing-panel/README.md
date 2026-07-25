# landing-panel — پنل مدیریت محتوای kurdnezam

Admin CMS for the **kurdnezam** landing site. React 19 + Vite + Ant Design 5 SPA, Persian/RTL,
light + dark, deployed at **landing-panel.myceo.ir**.

It is a sibling of `analytics-web/` and `mun-sanandaj-web/` in the mabhas19 repo and deliberately
mirrors their conventions (oidc-client-ts auth, `@` alias, nginx image, `npm run build` =
typecheck + vite build).

## Commands

```bash
cd landing-panel
npm install
npm run dev        # http://localhost:5175 (strictPort)
npm run typecheck  # tsc --noEmit (both tsconfigs)
npm run lint       # eslint, zero warnings allowed
npm run build      # typecheck + vite build -> dist/
npm run preview
```

Copy `.env.example` to `.env.local` first. `VITE_*` values are **baked at build time**.

| var | dev | prod |
| --- | --- | --- |
| `VITE_API_BASE` | `http://localhost:5000` | `https://api.mabhas19.myceo.ir` |
| `VITE_AUTH_ISSUER` | `http://localhost:5100` | `https://auth.myceo.ir` |
| `VITE_OIDC_CLIENT_ID` | `landing-panel` | `landing-panel` |
| `VITE_AUTH_SCOPE` | `openid profile email roles mabhas19.api` | same |

## Auth

Central OIDC IdP (OpenIddict, `src/Auth`). Public **PKCE** client `landing-panel`;
redirect `${origin}/auth/callback`, silent `${origin}/auth/silent`, post-logout `${origin}`.

`<RequireAdmin>` (src/auth/routes.tsx) gates **every** route except `/login` and `/auth/*`:
anonymous → `/login`; signed in without the **`Administrator`** role → a "دسترسی مدیریتی لازم است"
screen with a logout button. This mirrors the API, where reads are anonymous but every write
requires an Administrator bearer token.

## Layout of `src`

| path | what |
| --- | --- |
| `api/types.ts` | TS mirrors of every kurdnezam DTO (camelCase — System.Text.Json default) |
| `api/client.ts` | fetch wrapper, `ApiError` (ProblemDetails), `uploadMedia`, `mediaUrl` |
| `api/endpoints.ts` | one typed module per resource (`newsApi`, `categoriesApi`, …) |
| `query/` | `queryClient`, `queryKeys`, `useCrud` / `useApiQuery` / `useApiMutation` |
| `components/ui/` | `PageHeader` · `CrudTable` · `FormDrawer` · `ImageUploader` · `EmptyState` · `ErrorState` · `Loading` · `StatCard` |
| `layout/` | Sider + Header shell (collapsible, RTL, theme toggle, user menu) |
| `theme/tokens.ts` | `buildTheme(mode)`; mode persisted under `landing-panel-theme` |
| `pages/` | one page per route |

All CMS routes hang off `${VITE_API_BASE}/api/kurdnezam`. Images upload to
`POST /api/kurdnezam/media` (multipart, field `file`, ≤ 5 MB, png/jpeg/webp/gif) and are stored as
the returned server-relative URL.

## Deploy

`deploy/Dockerfile.landing-panel` builds from the **monorepo root** as context and serves `dist/`
from nginx with a SPA history fallback (`deploy/nginx.conf`). Bake the env with `--build-arg`:

```bash
docker build -f landing-panel/deploy/Dockerfile.landing-panel \
  --build-arg VITE_API_BASE=https://api.mabhas19.myceo.ir \
  --build-arg VITE_AUTH_ISSUER=https://auth.myceo.ir \
  -t landing-panel:latest .
```

The server is in Iran (Docker Hub blobs / `mcr.microsoft.com` are blocked), so build locally,
`docker save | gzip`, transfer, `docker load` — see the root `CLAUDE.md`.
