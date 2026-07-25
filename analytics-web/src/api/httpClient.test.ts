// analytics-web/src/api/httpClient.test.ts
// Tests for the HTTP client: base-URL composition, Authorization header,
// error handling, and JSON serialization.  No real network calls.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── helpers ────────────────────────────────────────────────────────────────

function makeFetch(status: number, body: unknown): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(String(body)),
  } as Response);
}

// ── env + module stubs ─────────────────────────────────────────────────────

// We need to control import.meta.env and the oidc module before importing
// httpClient — use vi.mock to intercept both.

vi.mock("../auth/oidc", () => ({
  getUserManager: () => ({
    getUser: vi.fn().mockResolvedValue({
      access_token: "test-access-token",
      expired: false,
    }),
  }),
}));

describe("httpClient", () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.resetModules();
  });

  it("GET: calls the correct URL (API_BASE + path)", async () => {
    // Patch env before dynamic import
    vi.stubEnv("VITE_API_BASE", "https://api.example.com");
    vi.stubEnv("VITE_AUTH_MODE", "mock"); // mock = no token header
    globalThis.fetch = makeFetch(200, { ok: true });

    const { httpClient } = await import("./httpClient");
    await httpClient.get("/api/Reports");

    expect(globalThis.fetch).toHaveBeenCalledOnce();
    const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/Reports");
    vi.unstubAllEnvs();
  });

  it("POST: sends JSON body and Content-Type header", async () => {
    vi.stubEnv("VITE_API_BASE", "https://api.example.com");
    vi.stubEnv("VITE_AUTH_MODE", "mock");
    globalThis.fetch = makeFetch(200, { id: "rep-1" });

    const { httpClient } = await import("./httpClient");
    const payload = { prompt: "hello", semanticModelId: "m1" };
    await httpClient.post("/api/Reports/generate", payload);

    const [, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(opts.method).toBe("POST");
    expect(opts.body).toBe(JSON.stringify(payload));
    const headers = opts.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    vi.unstubAllEnvs();
  });

  it("attaches Authorization: Bearer when VITE_AUTH_MODE=oidc", async () => {
    vi.stubEnv("VITE_API_BASE", "https://api.example.com");
    vi.stubEnv("VITE_AUTH_MODE", "oidc");
    globalThis.fetch = makeFetch(200, []);

    const { httpClient } = await import("./httpClient");
    await httpClient.get("/api/Reports");

    const [, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer test-access-token");
    vi.unstubAllEnvs();
  });

  it("does NOT attach Authorization header in mock-auth mode", async () => {
    vi.stubEnv("VITE_API_BASE", "https://api.example.com");
    vi.stubEnv("VITE_AUTH_MODE", "mock");
    globalThis.fetch = makeFetch(200, []);

    const { httpClient } = await import("./httpClient");
    await httpClient.get("/api/Reports");

    const [, opts] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    const headers = opts.headers as Record<string, string>;
    expect(headers["Authorization"]).toBeUndefined();
    vi.unstubAllEnvs();
  });

  it("throws HttpError on non-2xx status", async () => {
    vi.stubEnv("VITE_API_BASE", "https://api.example.com");
    vi.stubEnv("VITE_AUTH_MODE", "mock");
    globalThis.fetch = makeFetch(404, { title: "Not Found" });

    const { httpClient, HttpError } = await import("./httpClient");
    await expect(httpClient.get("/api/Reports/missing")).rejects.toBeInstanceOf(HttpError);
    vi.unstubAllEnvs();
  });
});
