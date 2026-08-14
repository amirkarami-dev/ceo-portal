# A save button that shows its own progress

**Date:** 2026-08-13
**Area:** `analytics-web/src/components/ui/SaveButton.tsx`, both dashboard save buttons
**Status:** **live** on analytic.myceo.ir

## The goal

Amir's suggestion: on click, show a spinner and stop accepting clicks until the request finishes;
then a success tick for two seconds; then back to normal. And if it is worth doing, make it a common
component.

It is worth doing — six save-ish buttons exist, four already passed a pending flag and **none** showed
success — with one addition.

## The addition: a failed save must never tick

The suggestion covered success only. The case that actually matters is failure: **a tick on a failed
save says the work is safe when it is not**, which is worse than no feedback at all.

So `SaveButton` drives itself from the promise: `idle → saving (disabled, spinner) → saved (tick, 2s)
→ idle`, and a rejection returns it to idle at once. It shows no error of its own — the caller knows
what failed and how the page says so.

## Adopting it found the trap immediately

Both existing handlers did this:

```ts
} catch { void message.error(t("dash.saveError")); }   // ← and then RESOLVES
```

They caught the error, showed a message, and resolved normally — so the button would have seen
success and drawn a tick straight over the failure toast. Both now re-throw after the message, with a
comment saying why, because the next handler will reach for the same swallow.

**A component that keys off a promise is only as honest as the promise it is given.**

## Three things it guards that a bare `loading={isPending}` does not

- **A second click.** Disabled for the whole request, so a slow save cannot be submitted twice — the
  reason this is a component rather than a convention.
- **A tick on failure.** Only a resolved promise earns one.
- **A timer outliving its button.** A save can finish after the user has navigated away; the
  two-second timeout is cleared on unmount and guarded by a liveness ref.

## One deliberate choice

The label does not change to «در حال ذخیره…». Text moving under the cursor is worse than a steady
button, so the state is announced through `aria-label` instead, for anyone not seeing the icon.

## Where it is used

Both dashboard save buttons. `AskAiBuilder`'s Save only opens a modal — it is not a save — so it was
left alone. The two admin settings buttons are `htmlType="submit"` inside a form; they can adopt it
when their handlers return promises.

## Verified

428 front-end tests, six of them this component's, including the failure case and the unmount case.
Lint and build clean. Deployed `index-CZSS6_SI.js` → `index-CwukU9Sg.js`, container healthy, HTTPS
200, the new labels present in the served bundle, other stacks untouched.

## Worth knowing

- The component lives in `analytics-web`. The other SPAs each keep their own copy of shared UI in
  this repo (`AppSwitcher` is duplicated eight times), so this follows the house pattern rather than
  introducing a shared package for one button.
- **Not clicked on production yet.** The states are proven by tests and the bundle is confirmed live,
  but nobody has watched a real save spin and tick on analytic.myceo.ir.
