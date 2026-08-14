import { Button, type ButtonProps } from "antd";
import { CheckOutlined, SaveOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/** How long the tick stays up before the button goes back to normal. */
const SUCCESS_MS = 2000;

type Phase = "idle" | "saving" | "saved";

export interface SaveButtonProps extends Omit<ButtonProps, "onClick" | "loading" | "icon"> {
  /**
   * The save itself. Whatever it returns is awaited, so the button knows when the work is really
   * finished rather than when the click ended.
   *
   * **Let it reject on failure.** A rejection keeps the tick away and hands the error back to the
   * caller, which is where the message belongs — the button does not know what went wrong or how the
   * page wants to say so.
   */
  onSave: () => unknown | Promise<unknown>;
}

/**
 * A save button that shows its own progress: spinner while the request is in flight, a tick for two
 * seconds after it succeeds, then back to normal.
 *
 * Two things it guarantees that a bare `loading={isPending}` does not:
 *
 * - **It cannot be clicked twice.** The button disables itself for the whole request, so a slow save
 *   cannot be submitted again — the reason it is a component and not a convention.
 * - **A failed save never shows a tick.** Only a resolved promise earns one; a rejection returns the
 *   button to normal at once and re-throws nothing, leaving the caller's own error handling intact.
 */
export function SaveButton({ onSave, children, disabled, ...rest }: SaveButtonProps) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>("idle");

  // The tick is on a timer, and a save can finish after the user has already navigated away. Without
  // this the timer fires into an unmounted component.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  const click = useCallback(async () => {
    if (phase === "saving") return;
    // Clicking again during the tick starts a real save; the leftover timer must not then drop the
    // button out of "saving" while the second request is still running.
    clearTimeout(timer.current);
    setPhase("saving");
    try {
      await onSave();
      if (!alive.current) return;
      setPhase("saved");
      timer.current = setTimeout(() => {
        if (alive.current) setPhase("idle");
      }, SUCCESS_MS);
    } catch {
      // Straight back to normal. The caller shows the error — it knows what failed.
      if (alive.current) setPhase("idle");
    }
  }, [onSave, phase]);

  const label = children ?? t("common.save");

  return (
    <Button
      type="primary"
      {...rest}
      icon={phase === "saved" ? <CheckOutlined /> : <SaveOutlined />}
      loading={phase === "saving"}
      disabled={disabled || phase === "saving"}
      // The label does not change — a button whose text moves under the cursor is worse than a
      // steady one — so the state is announced here instead, for anyone not seeing the icon.
      aria-label={
        phase === "saving"
          ? t("common.saving")
          : phase === "saved"
            ? t("common.saved")
            : undefined
      }
      onClick={() => void click()}
    >
      {label}
    </Button>
  );
}
