import { ActivityIndicator, Pressable, Text, View } from "react-native"
import { Redirect, Stack, useRouter } from "expo-router"
import { useAuth } from "@/lib/auth-context"
import { t } from "@/i18n"
import { colors } from "@/theme"

// Protected route group: requires an authenticated user.
export default function AppLayout() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  if (!user) {
    return <Redirect href="/login" />
  }

  const LogoutButton = () => (
    <Pressable
      onPress={async () => {
        await logout()
        router.replace("/login")
      }}
      hitSlop={8}
    >
      <Text style={{ color: colors.danger, fontWeight: "600" }}>{t("logout")}</Text>
    </Pressable>
  )

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.foreground,
        headerTitleStyle: { fontWeight: "700" },
        contentStyle: { backgroundColor: colors.surfaceMuted },
      }}
    >
      <Stack.Screen
        name="projects/index"
        options={{ title: t("projects"), headerRight: () => <LogoutButton /> }}
      />
      <Stack.Screen name="projects/new" options={{ title: t("newProject") }} />
      <Stack.Screen name="projects/[id]" options={{ title: t("assessment") }} />
      <Stack.Screen name="projects/checklist" options={{ title: t("assessment") }} />
    </Stack>
  )
}
