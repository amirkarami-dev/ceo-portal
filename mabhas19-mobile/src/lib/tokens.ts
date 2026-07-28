// Bearer-token persistence via expo-secure-store, with an in-memory cache so the
// API client can read the access token synchronously between requests.
import * as SecureStore from "expo-secure-store"
import type { TokenResponse } from "./types"

const ACCESS_KEY = "m19_access_token"
const REFRESH_KEY = "m19_refresh_token"

let cache: { access: string | null; refresh: string | null } = {
  access: null,
  refresh: null,
}

export const tokenStore = {
  // Hydrate the in-memory cache from secure storage (call once at startup).
  async load(): Promise<{ access: string | null; refresh: string | null }> {
    cache = {
      access: await SecureStore.getItemAsync(ACCESS_KEY),
      refresh: await SecureStore.getItemAsync(REFRESH_KEY),
    }
    return cache
  },

  getAccess(): string | null {
    return cache.access
  },

  getRefresh(): string | null {
    return cache.refresh
  },

  async set(tokens: TokenResponse): Promise<void> {
    cache = { access: tokens.accessToken, refresh: tokens.refreshToken }
    await SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken)
    await SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken)
  },

  async clear(): Promise<void> {
    cache = { access: null, refresh: null }
    await SecureStore.deleteItemAsync(ACCESS_KEY)
    await SecureStore.deleteItemAsync(REFRESH_KEY)
  },
}
