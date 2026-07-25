import { redirect } from "next/navigation"

// Subscription is hidden from users — redirect any direct visit to the dashboard.
export default async function SubscriptionPage({
  params,
}: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  // as-needed locale prefix: fa is unprefixed, en is /en.
  redirect(locale === "en" ? "/en/dashboard" : "/dashboard")
}
