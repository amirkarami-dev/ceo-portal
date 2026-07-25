import { getUserManager } from "../auth/oidc";

const API_BASE = import.meta.env.VITE_API_BASE as string;

async function authHeaders(): Promise<HeadersInit> {
  const user = await getUserManager().getUser();
  return user?.access_token ? { Authorization: `Bearer ${user.access_token}` } : {};
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { headers: await authHeaders() });
  if (!response.ok) throw new Error(`GET ${path} failed: ${response.status}`);
  return (await response.json()) as T;
}

export async function apiPost<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { method: "POST", headers: await authHeaders() });
  if (!response.ok) throw new Error(`POST ${path} failed: ${response.status}`);
  return (await response.json()) as T;
}
