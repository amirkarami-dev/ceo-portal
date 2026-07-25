import createMiddleware from "next-intl/middleware"
import { NextResponse, type NextRequest } from "next/server"
import { routing } from "./i18n/routing"

// next-intl owns EVERY response (locale routing/rewrites) exactly as before — we do NOT
// wrap it in Auth.js's auth() helper, because behind a reverse proxy (Traefik) with
// AUTH_TRUST_HOST + AUTH_URL the wrapper rebases next-intl's "/" -> "/fa" rewrite to an
// absolute external URL, which the standalone server then tries to proxy (EAI_AGAIN).
//
// Auth here is a cheap session-cookie PRESENCE gate for protected routes (real validation
// is the API's JWT check + the server components). Role-gated admin routes are gated
// server-side in their own layouts via auth(); the in-app /admin user-management route
// was removed (it moved to the separate admin app at admin.myceo.ir).
const intlMiddleware = createMiddleware(routing)

const PROTECTED = /^\/(?:en\/)?(?:dashboard|projects|import|subscription|reports)(?:\/|$)/

export default function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (PROTECTED.test(pathname)) {
    // Matches authjs.session-token / __Secure-authjs.session-token (+ chunked .0/.1) across
    // http (local) and https (prod), without decrypting.
    const hasSession = req.cookies
      .getAll()
      .some((c) => c.name.includes("session-token"))
    if (!hasSession) {
      const isEn = pathname === "/en" || pathname.startsWith("/en/")
      return NextResponse.redirect(
        new URL(isEn ? "/en/login" : "/login", req.nextUrl)
      )
    }
  }

  return intlMiddleware(req)
}

export const config = {
  // Match all paths except api, static files, and Next internals.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
}
