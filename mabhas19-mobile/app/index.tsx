import { ActivityIndicator, View } from "react-native"
import { Redirect } from "expo-router"
import { useAuth } from "@/lib/auth-context"
import { colors } from "@/theme"

// Entry gate: route to the app or the login screen based on auth state.
export default function Index() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceMuted }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  return <Redirect href={user ? "/(app)/projects" : "/login"} />
}
