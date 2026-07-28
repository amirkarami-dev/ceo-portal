"use client"

import { useTranslations } from "next-intl"
import { signIn } from "next-auth/react"
import { Button, CardBody, CardHeader, Spinner } from "@/components/ui"
import { useState } from "react"

export default function LoginPage() {
  const t = useTranslations("auth")
  const [loading, setLoading] = useState(false)

  const handleSignIn = async () => {
    setLoading(true)
    await signIn("mabhas19", { callbackUrl: "/dashboard" })
  }

  return (
    <>
      <CardHeader>
        <h1 className="text-lg font-bold text-slate-900">{t("loginTitle")}</h1>
      </CardHeader>
      <CardBody>
        <p className="mb-6 text-sm text-slate-600">
          {t("ssoPrompt")}
        </p>
        <Button
          type="button"
          className="w-full"
          disabled={loading}
          onClick={() => void handleSignIn()}
        >
          {loading ? <Spinner className="me-2" /> : null}
          {t("ssoButton")}
        </Button>
      </CardBody>
    </>
  )
}
