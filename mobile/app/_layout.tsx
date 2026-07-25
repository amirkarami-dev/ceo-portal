import { useEffect } from "react"
import { I18nManager } from "react-native"
import { Stack } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { SafeAreaProvider } from "react-native-safe-area-context"
import { AuthProvider } from "@/lib/auth-context"
import { isRTL } from "@/i18n"
import { colors } from "@/theme"

// Force RTL layout for the Persian-first UI.
if (isRTL && !I18nManager.isRTL) {
  I18nManager.allowRTL(true)
  I18nManager.forceRTL(true)
}

export default function RootLayout() {
  useEffect(() => {
    if (isRTL && !I18nManager.isRTL) {
      I18nManager.allowRTL(true)
      I18nManager.forceRTL(true)
    }
  }, [])

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.surface },
            headerTintColor: colors.foreground,
            headerTitleStyle: { fontWeight: "700" },
            contentStyle: { backgroundColor: colors.surfaceMuted },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="(app)" options={{ headerShown: false }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  )
}
