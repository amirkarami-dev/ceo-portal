import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import type { ReactNode } from "react";
import { i18n } from "@/i18n";
import { SaveButton } from "./SaveButton";

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
);

/** A promise the test decides when to settle, so "in flight" is a state we can inspect. */
function deferred<T = void>() {
  let resolve!: (v: T) => void;
  let reject!: (e?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const button = () => screen.getByRole("button");
const hasIcon = (name: string) =>
  !!button().querySelector(`.anticon-${name}`);

beforeEach(async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  await i18n.changeLanguage("fa");
});
afterEach(() => {
  vi.useRealTimers();
});

describe("SaveButton", () => {
  it("cannot be clicked twice while the save is in flight", async () => {
    const d = deferred();
    const onSave = vi.fn(() => d.promise);
    render(<SaveButton onSave={onSave} />, { wrapper });

    await act(async () => {
      button().click();
    });

    // This is the reason it is a component rather than a convention: a slow save used to be
    // submittable again by an impatient second click.
    expect(button()).toBeDisabled();
    await act(async () => {
      button().click();
    });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("shows a tick when the save succeeds, then goes back on its own", async () => {
    const d = deferred();
    render(<SaveButton onSave={() => d.promise} />, { wrapper });

    await act(async () => {
      button().click();
    });
    expect(hasIcon("check")).toBe(false);

    await act(async () => {
      d.resolve();
      await d.promise;
    });
    expect(hasIcon("check")).toBe(true);
    expect(button()).not.toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(hasIcon("check")).toBe(false);
    expect(hasIcon("save")).toBe(true);
  });

  it("NEVER shows a tick when the save fails", async () => {
    const d = deferred();
    render(<SaveButton onSave={() => d.promise} />, { wrapper });

    await act(async () => {
      button().click();
    });
    await act(async () => {
      d.reject(new Error("boom"));
      await d.promise.catch(() => undefined);
    });

    // A tick on a failed save is worse than no feedback at all — it says the work is safe when it
    // is not. The caller still shows its own error.
    expect(hasIcon("check")).toBe(false);
    expect(hasIcon("save")).toBe(true);
    expect(button()).not.toBeDisabled();
  });

  it("says what it is doing, for anyone not seeing the icon", async () => {
    const d = deferred();
    render(<SaveButton onSave={() => d.promise} />, { wrapper });

    await act(async () => {
      button().click();
    });
    expect(button().getAttribute("aria-label")).toBe("در حال ذخیره…");

    await act(async () => {
      d.resolve();
      await d.promise;
    });
    expect(button().getAttribute("aria-label")).toBe("ذخیره شد");
  });

  it("keeps the caller's own disabled state", () => {
    render(<SaveButton onSave={() => undefined} disabled />, { wrapper });
    // The dashboard page disables Save until edit mode is on; the component must not override that.
    expect(button()).toBeDisabled();
  });

  it("does not fire its timer into a component that has gone", async () => {
    const d = deferred();
    const { unmount } = render(<SaveButton onSave={() => d.promise} />, { wrapper });

    await act(async () => {
      button().click();
    });
    await act(async () => {
      d.resolve();
      await d.promise;
    });
    unmount();

    // A save can finish after the user has navigated away; the two-second timer must not outlive
    // the button.
    expect(() => act(() => void vi.advanceTimersByTime(2000))).not.toThrow();
  });
});
