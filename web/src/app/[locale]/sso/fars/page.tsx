"use client"

import { Suspense, useEffect, useRef } from "react"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { Spinner } from "@/components/ui"

/**
 * FarsNezam magic-link entry: /sso/fars?co=<CodeOzveyat>&pno=<ProjectNo>
 * Kicks off OIDC with login_hint=fars:<co> so the IdP auto-provisions the engineer,
 * then lands on /sso/fars/finish?pno=<pno> to provision the project.
 */
function FarsSsoEntry() {
  const t = useTranslations("sso")
  const params = useSearchParams()
  const co = params?.get("co")?.trim() ?? ""
  const pno = params?.get("pno")?.trim() ?? ""
  const fired = useRef(false)

  const valid = co.length > 0 && pno.length > 0

  useEffect(() => {
    if (!valid || fired.current) return
    fired.current = true
    void signIn(
      "mabhas19",
      { callbackUrl: `/sso/fars/finish?pno=${encodeURIComponent(pno)}` },
      { login_hint: `fars:${co}` },
    )
  }, [valid, co, pno])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {valid ? (
          <>
            <Spinner className="mx-auto h-8 w-8 text-primary" />
            <h1 className="mt-4 text-base font-bold text-card-foreground">{t("connecting")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("connectingHint")}</p>
          </>
        ) : (
          <>
            <h1 className="text-base font-bold text-destructive">{t("missingParams")}</h1>
            <Link href="/" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
              {t("backHome")}
            </Link>
          </>
        )}
      </div>
    </div>
  )
}

export default function FarsSsoPage() {
  return (
    <Suspense fallback={null}>
      <FarsSsoEntry />
    </Suspense>
  )
}
