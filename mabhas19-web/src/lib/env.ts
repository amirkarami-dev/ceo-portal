// Centralised, validated access to public environment variables.
// NEXT_PUBLIC_* values are inlined at build time by Next.js, so this resolves once.
const apiBase = process.env.NEXT_PUBLIC_API_BASE?.trim()

if (!apiBase && process.env.NODE_ENV === "production") {
  // Surface a misconfigured production build loudly instead of silently calling localhost.
  console.warn("NEXT_PUBLIC_API_BASE is not set; falling back to http://localhost:5000")
}

export const env = {
  apiBase: apiBase || "http://localhost:5000",
} as const
