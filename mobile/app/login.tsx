import { useEffect } from "react"
import { View } from "react-native"
import { useRouter } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import { useAutoDiscovery, useAuthRequest } from "expo-auth-session"
import { AppText, Button, Card, Screen } from "@/components/ui"
import { useAuth } from "@/lib/auth-context"
import { AUTH_ISSUER, clientId, scopes, redirectUri } from "@/lib/oidc"
import { t } from "@/i18n"
import { colors, spacing } from "@/theme"

// Required on Android so the browser tab can hand the auth result back.
WebBrowser.maybeCompleteAuthSession()

export default function LoginScreen() {
  const router = useRouter()
  const { completeSignIn } = useAuth()

  const discovery = useAutoDiscovery(AUTH_ISSUER)

  const [request, result, promptAsync] = useAuthRequest(
    {
      clientId,
      scopes,
      redirectUri,
      usePKCE: true,
    },
    discovery,
  )

  // Handle the result from the browser redirect.
  useEffect(() => {
    if (result?.type !== "success") return
    const code = result.params.code
    if (!code) return

    void completeSignIn(code, request?.codeVerifier, discovery!).then(() => {
      router.replace("/(app)/projects")
    })
  // `discovery` and `request` are stable references from hooks; `result` is
  // the only value that actually changes between renders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result])

  const isLoading = !request || !discovery

  return (
    <Screen>
      <View
        style={{
          alignItems: "center",
          marginTop: spacing.xl,
          marginBottom: spacing.lg,
          gap: 4,
        }}
      >
        <AppText variant="title">{t("appName")}</AppText>
        <AppText variant="muted">{t("tagline")}</AppText>
      </View>

      <Card>
        {result?.type === "error" ? (
          <AppText style={{ color: colors.danger, marginBottom: spacing.sm }}>
            {t("loginFailed")}
          </AppText>
        ) : null}

        <Button
          title={isLoading ? t("signingIn") : t("loginWithSso")}
          onPress={() => void promptAsync()}
          loading={isLoading}
          disabled={isLoading}
        />
      </Card>
    </Screen>
  )
}
