import { Typography, message } from "antd";
import { CheckOutlined, EditOutlined, LoadingOutlined } from "@ant-design/icons";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

/** How long the tick stays up before the pencil comes back. Same as SaveButton. */
export const SUCCESS_MS = 2000;

type Phase = "idle" | "saving" | "saved";

export interface EditableLabelProps {
  /** The text to show, already resolved for the current language. */
  value: string;
  /**
   * The save. Awaited, so the control knows when the request really finished.
   *
   * **Let it reject on failure.** A rejection keeps the editor open with the user's text still in it,
   * so nothing they typed is lost and they can retry or cancel.
   */
  onSave: (next: string) => unknown | Promise<unknown>;
  /** Heading level when rendering as a title. Ignored for `as="text"`. */
  level?: 1 | 2 | 3 | 4 | 5;
  as?: "title" | "text";
  /**
   * Accessible name for the pencil. **Must be a string** — antd derives the button's `aria-label`
   * from it with `typeof editTitle === "string" ? editTitle : ""`, so a ReactNode leaves the button
   * nameless. Defaults to «ویرایش» / "Edit".
   */
  tooltip?: string;
  maxLength?: number;
  /** No pencil at all. Use when the reader may not edit, or there is nothing to save to. */
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A label you can rename in place.
 *
 * antd's `Typography` already draws the pencil and the textarea. What it does not do is survive a
 * save that takes time or fails: `EditConfig` has no `loading`, no error channel and no validation,
 * and its internal handler calls `onChange(value)` and then closes the editor immediately — before a
 * promise could possibly resolve. So this component owns `editing` and only lets go when the request
 * has actually finished.
 *
 * The feedback follows the same convention as `SaveButton`, because it is the same promise to the
 * reader: spinner while it is in flight, a tick for two seconds, then back to normal.
 *
 * What it guarantees:
 *
 * - **A failed save keeps your text.** The editor stays open with what you typed still in it. Closing
 *   on failure would silently discard the edit and leave the old label looking correct.
 * - **No request for a no-op.** Pressing enter without changing anything just closes.
 * - **The pencil always has a name.** Screen readers get «ویرایش» / "Edit", not an unlabelled button.
 */
export function EditableLabel({
  value,
  onSave,
  level = 3,
  as = "title",
  tooltip,
  maxLength = 200,
  disabled,
  className,
  style,
}: EditableLabelProps) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");

  // A save can finish after the reader has navigated away, and the tick is on a timer.
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  /**
   * antd's `onChange` is a *commit attempt*, not a change event, and one edit can produce several.
   * Measured: pressing Enter and then blurring fires `onChange` → `onEnd` → `onChange`, so a single
   * rename would POST twice. A ref rather than the `phase` state because both attempts can arrive
   * before React has re-rendered.
   */
  const inFlight = useRef(false);

  const change = useCallback(
    async (next: string) => {
      if (inFlight.current) return;
      const trimmed = next.trim();

      // Nothing changed — and an empty box means "no override", which is the caller's business to
      // interpret, not a reason to fire a request for the same string. antd already trims and strips
      // newlines before it gets here; this also covers the Enter-with-nothing-edited case, which
      // still fires onChange.
      if (trimmed === value.trim()) {
        setEditing(false);
        return;
      }

      inFlight.current = true;
      clearTimeout(timer.current);
      setPhase("saving");
      try {
        await onSave(trimmed);
        if (!alive.current) return;
        setEditing(false);
        setPhase("saved");
        timer.current = setTimeout(() => {
          if (alive.current) setPhase("idle");
        }, SUCCESS_MS);
      } catch {
        if (!alive.current) return;
        // Stay open, keep their text. Measured: closing the editor unmounts antd's Editable, whose
        // draft re-seeds from the `text` prop on the next mount — so closing here would silently
        // discard what they typed and leave the old label on screen looking like it saved.
        setPhase("idle");
        setEditing(true);
        message.error(t("common.saveFailed"));
      } finally {
        inFlight.current = false;
      }
    },
    [onSave, value, t],
  );

  const Component = as === "text" ? Typography.Text : Typography.Title;
  const triggerName = tooltip ?? t("common.edit");

  return (
    <span className="rw-editable" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <Component
        {...(as === "title" ? { level } : {})}
        className={className}
        style={{ margin: 0, ...style }}
        editable={
          disabled
            ? false
            : {
                editing,
                // Controlled: antd closes the editor itself the moment onChange fires, so the parent
                // has to be the one still saying "open" while the request is in flight.
                onStart: () => setEditing(true),
                onChange: (next: string) => void change(next),
                onCancel: () => setEditing(false),
                // A string, deliberately — antd reads aria-label off this and a ReactNode gives "".
                tooltip: triggerName,
                maxLength,
                // Supplied only to stop antd using its own fallback, which is
                // `EditOutlined role="button"` *inside* the real `<button>` — a nested interactive
                // role, visible in the accessibility tree as a button within a button. Same pencil,
                // without the second role. (The progress state is not here; see below.)
                icon: <EditOutlined />,
              }
        }
      >
        {value}
      </Component>

      {/*
        The progress lives OUTSIDE antd's element, not in `editable.icon`.

        Two reasons, both found by testing rather than by reading. While `editing` is true antd
        replaces the whole element with a textarea and the pencil trigger is not rendered at all — so a
        spinner handed to `editable.icon` is invisible during exactly the moment it is meant to
        describe. And the trigger remounts when editing closes, which made the tick behave as if it
        were frozen. Here the state is plain markup this component owns, on screen whether the editor
        is open or shut.
      */}
      {phase === "saving" && <LoadingOutlined aria-label={t("common.saving")} />}
      {phase === "saved" && (
        <CheckOutlined aria-label={t("common.saved")} style={{ color: "var(--rw-primary-ink)" }} />
      )}
    </span>
  );
}
