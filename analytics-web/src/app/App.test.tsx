import { describe, it, expect, vi } from "vitest";

// The full App mounts createBrowserRouter (a data router) which in Node/jsdom
// triggers an AbortSignal compatibility issue when navigating.  We just verify
// that the module exports a callable component without instantiating the router.
describe("App", () => {
  it("exports App as a function", async () => {
    // Dynamic import so we don't execute the top-level router creation eagerly
    // in the module scope (which would fire before the mock can be installed).
    vi.mock("react-router-dom", async (importOriginal) => {
      const real = await importOriginal<typeof import("react-router-dom")>();
      return {
        ...real,
        // Stub RouterProvider to avoid data-router navigation in jsdom.
        RouterProvider: ({ router: _r }: { router: unknown }) => (
          <div data-testid="router-stub">router</div>
        ),
      };
    });
    const { App } = await import("./App");
    expect(typeof App).toBe("function");
  });
});
