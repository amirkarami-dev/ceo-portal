import { describe, it, expect, vi } from "vitest";

// This test asserts one thing — that App is exported as a component — and used to
// take about four seconds to do it, because importing App pulls in ./router, which
// builds the entire route table at module scope: every page, the admin shell, the
// chart renderers. Alone that was slow; inside a full parallel run it blew the 10s
// timeout and failed for no reason anyone could act on.
//
// Both the router object and RouterProvider are stubbed, so the import costs almost
// nothing. Nothing is lost: router.test.tsx is what actually exercises the routes.
vi.mock("./router", () => ({ router: {} }));

// Providers is the other half of the cost: antd, i18n, the theme and the query
// client all load just to be imported. Nothing here renders, so stub it too.
vi.mock("./providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock("react-router-dom", async (importOriginal) => {
  const real = await importOriginal<typeof import("react-router-dom")>();
  return {
    ...real,
    // Stub RouterProvider to avoid data-router navigation in jsdom.
    RouterProvider: () => <div data-testid="router-stub">router</div>,
  };
});

describe("App", () => {
  it("exports App as a function", async () => {
    const { App } = await import("./App");
    expect(typeof App).toBe("function");
  });

  it("exports the same component as the default", async () => {
    const mod = await import("./App");
    expect(mod.default).toBe(mod.App);
  });
});
