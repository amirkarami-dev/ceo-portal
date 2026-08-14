import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nextProvider } from "react-i18next";
import { ConfigProvider } from "antd";
import faIR from "antd/locale/fa_IR";
import type { ReactNode } from "react";
import { i18n } from "@/i18n";
import { EditableLabel, SUCCESS_MS } from "./EditableLabel";

const wrapper = ({ children }: { children: ReactNode }) => (
  <I18nextProvider i18n={i18n}>
    <ConfigProvider locale={faIR}>{children}</ConfigProvider>
  </I18nextProvider>
);

/** The pencil. antd names it from `tooltip`, so this is also the a11y assertion. */
const pencil = () => screen.getByRole("button", { name: "ویرایش" });
const box = () => screen.getByRole("textbox");

/**
 * Confirm the edit the way antd listens for it.
 *
 * antd's Editable confirms on **keyUp**, gated on `keyCode === KeyCode.ENTER` and on the preceding
 * keyDown having recorded the same code (Editable.js:57-85). user-event's `{Enter}` arrives with
 * **keyCode 0** — measured — so it never satisfies that check and nothing is saved. Real browsers
 * send 13. Driving the events directly is therefore the only way to test the Enter path here; it is
 * not a workaround for a broken component.
 */
const pressEnter = (el: HTMLElement) => {
  fireEvent.keyDown(el, { keyCode: 13 });
  fireEvent.keyUp(el, { keyCode: 13 });
};

/** Same story for Escape — antd checks keyCode 27. */
const pressEscape = (el: HTMLElement) => {
  fireEvent.keyDown(el, { keyCode: 27 });
  fireEvent.keyUp(el, { keyCode: 27 });
};

beforeEach(async () => {
  await i18n.changeLanguage("fa");
});
afterEach(() => {
  vi.useRealTimers();
});

async function openAndType(text: string) {
  const user = userEvent.setup();
  await user.click(pencil());
  const input = box();
  await user.clear(input);
  await user.type(input, text);
  return user;
}

describe("EditableLabel", () => {
  it("shows the value and a named pencil", () => {
    render(<EditableLabel value="تعداد مهندسان" onSave={vi.fn()} />, { wrapper });

    expect(screen.getByText("تعداد مهندسان")).toBeInTheDocument();
    // An unlabelled icon button is invisible to a screen reader. antd only copies `tooltip` into
    // aria-label when it is a string, which is why the prop is typed as one.
    expect(pencil()).toBeInTheDocument();
  });

  it("saves what was typed, trimmed", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EditableLabel value="قديمى" onSave={onSave} />, { wrapper });

    await openAndType("  فروش خالص  ");
    pressEnter(box());

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("فروش خالص"));
  });

  it("closes after a save that worked", async () => {
    render(<EditableLabel value="a" onSave={vi.fn().mockResolvedValue(undefined)} />, { wrapper });

    await openAndType("b");
    pressEnter(box());

    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
  });

  // ── The reason this component exists ─────────────────────────────────────
  // antd calls onChange and then closes the editor itself, before any promise can settle. If the
  // parent does not hold it open, a failed save silently discards the edit and the stale label sits
  // there looking correct.

  it("keeps the editor open and the text intact when the save fails", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("network"));
    render(<EditableLabel value="قديمى" onSave={onSave} />, { wrapper });

    await openAndType("فروش خالص");
    pressEnter(box());

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    // Still editing, and what they typed is still there.
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveValue("فروش خالص");
  });

  it("does not fire a request when nothing changed", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EditableLabel value="تعداد" onSave={onSave} />, { wrapper });

    const user = userEvent.setup();
    await user.click(pencil());
    pressEnter(box());

    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("treats a whitespace-only difference as no change", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EditableLabel value="تعداد" onSave={onSave} />, { wrapper });

    await openAndType("  تعداد  ");
    pressEnter(box());

    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    expect(onSave).not.toHaveBeenCalled();
  });

  it("discards the edit on cancel without saving", async () => {
    const onSave = vi.fn();
    render(<EditableLabel value="قديمى" onSave={onSave} />, { wrapper });

    await openAndType("something else");
    pressEscape(box());

    await waitFor(() => expect(screen.queryByRole("textbox")).not.toBeInTheDocument());
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("قديمى")).toBeInTheDocument();
  });

  // Real timers on purpose. Faking them here fought userEvent — which drives its own delays through
  // the same clock — and the tick never cleared. A single real 2s wait is cheaper than a mocked clock
  // that has to be reasoned about, and it exercises the timer the reader actually sees.
  it("shows a tick after saving, then goes back to the pencil", async () => {
    render(<EditableLabel value="a" onSave={vi.fn().mockResolvedValue(undefined)} />, { wrapper });

    await openAndType("b");
    pressEnter(box());

    // Same promise SaveButton makes: a tick, briefly, then normal.
    await waitFor(() => expect(screen.getByLabelText("ذخیره شد")).toBeInTheDocument());
    await waitFor(() => expect(screen.queryByLabelText("ذخیره شد")).not.toBeInTheDocument(), {
      timeout: SUCCESS_MS + 1500,
    });
    expect(pencil()).toBeInTheDocument();
  });

  it("offers no pencil when disabled", () => {
    render(<EditableLabel value="x" onSave={vi.fn()} disabled />, { wrapper });

    expect(screen.getByText("x")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("takes a custom accessible name for the pencil", () => {
    render(<EditableLabel value="x" onSave={vi.fn()} tooltip="ویرایش عنوان" />, { wrapper });

    expect(screen.getByRole("button", { name: "ویرایش عنوان" })).toBeInTheDocument();
  });

  // In edit mode antd REPLACES the element — an <h3> becomes a <div> — so a heading assertion
  // silently stops matching. Pinned here so the next person does not spend an hour on it.
  it("renders a heading when idle, and stops being one while editing", async () => {
    render(<EditableLabel value="عنوان" onSave={vi.fn()} level={3} />, { wrapper });

    expect(screen.getByRole("heading", { level: 3 })).toBeInTheDocument();

    await userEvent.setup().click(pencil());

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("can render as plain text rather than a heading", () => {
    render(<EditableLabel value="x" onSave={vi.fn()} as="text" />, { wrapper });

    expect(screen.queryByRole("heading")).not.toBeInTheDocument();
    expect(screen.getByText("x")).toBeInTheDocument();
  });

  // ── antd fires onChange more than once per edit ───────────────────────────
  // Measured: Enter then blur produces onChange → onEnd → onChange. Without a guard one rename
  // becomes two PUTs. These are the paths that guard exists for.

  it("saves once when Enter is followed by a blur", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EditableLabel value="a" onSave={onSave} />, { wrapper });

    await openAndType("b");
    const input = box();
    pressEnter(input);
    fireEvent.blur(input);

    await waitFor(() => expect(onSave).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 250));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("saves on blur alone, for someone who clicks away instead of pressing enter", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<EditableLabel value="a" onSave={onSave} />, { wrapper });

    await openAndType("b");
    fireEvent.blur(box());

    await waitFor(() => expect(onSave).toHaveBeenCalledWith("b"));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  // Escape fires onCancel and does NOT revert antd's draft. If the editor were left open, the blur
  // that follows would commit the text the user just abandoned — turning a cancel into a save.
  it("a blur after Escape does not save", async () => {
    const onSave = vi.fn();
    render(<EditableLabel value="قديمى" onSave={onSave} />, { wrapper });

    await openAndType("abandoned");
    const input = box();
    pressEscape(input);
    fireEvent.blur(input);

    await new Promise((r) => setTimeout(r, 250));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("قديمى")).toBeInTheDocument();
  });

  it("does not blow up if it unmounts while a save is in flight", async () => {
    let resolve!: () => void;
    const onSave = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const { unmount } = render(<EditableLabel value="a" onSave={onSave} />, { wrapper });

    await openAndType("b");
    pressEnter(box());
    await waitFor(() => expect(onSave).toHaveBeenCalled());

    unmount();
    await act(async () => {
      resolve();
    });
    // No "setState on unmounted" warning and no timer firing into nothing.
  });
});
