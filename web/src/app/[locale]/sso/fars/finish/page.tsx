"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/navigation"
import { useImportProject } from "@/lib/queries"
import { Spinner } from "@/components/ui"

/**
 * Post-login half of the FarsNezam magic-link: provisions (or finds — the import is
 * idempotent) the project for the now-authenticated engineer, then opens it.
 */
function FarsSsoFinish() {
  const t = useTranslations("sso")
  const params = useSearchParams()
  const router = useRouter()
  const pno = params?.get("pno")?.trim() ?? ""
  const importProject = useImportProject()
  const fired = useRef(false)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!pno || fired.current) return
    fired.current = true
    importProject.mutate(
      { source: "FarsNezam", externalId: pno },
      {
        onSuccess: (id) => router.replace(`/projects/${id}`),
        onError: () => setError(true),
      },
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pno])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
        {!pno ? (
          <>
            <h1 className="text-base font-bold text-destructive">{t("missingParams")}</h1>
            <Link href="/" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
              {t("backHome")}
            </Link>
          </>
        ) : error ? (
          <>
            <h1 className="text-base font-bold text-destructive">{t("importError")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("importErrorHint", { pno })}</p>
            <Link href="/projects" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">
              {t("goProjects")}
            </Link>
          </>
        ) : (
          <>
            <Spinner className="mx-auto h-8 w-8 text-primary" />
            <h1 className="mt-4 text-base font-bold text-card-foreground">{t("provisioning")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("provisioningHint", { pno })}</p>
          </>
        )}
      </div>
    </div>
  )
}

export default function FarsSsoFinishPage() {
  return (
    <Suspense fallback={null}>
      <FarsSsoFinish />
    </Suspense>
  )
}
