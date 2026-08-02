# VMS — the mobile menu, and a drawer bug that was never about the drawer

- **Date:** 2026-08-03
- **Area:** `vms-web` (layout, theme), `room-web` (theme)
- **Branch / commits:** `main` — `2c5d3b5`
- **Status:** **fixed and deployed.**

## What Amir asked

> also fix menu on mobile view and when open the menu (vms.myceo.ir/admin) in my opinion must show
> same drawer or open menu standard on mobile view

He was right, and the repo already said so. GOTCHAS: *"below AntD's `md` breakpoint render navigation
in a Drawer, compact the Topbar, and remove the Sider from the flex row entirely."* `analytics-web`
and `walfare-web` do that. `vms-web` did not — I copied its layout from `room-web`, which never had
it either.

## The layout rewrite

`vms-web/src/layout/AppLayout.tsx`, switching on `Grid.useBreakpoint()` → `isMobile = !screens.md`:

- Below `md` the `Sider` is **not rendered at all**. Not collapsed — gone. An auto-collapsed Sider is
  still a flex child, so opening it *pushes* the page sideways instead of overlaying it.
- Navigation moves into a `Drawer`, `placement="right"` because the app is RTL: it comes from the
  same side as the trigger, and a left drawer would fight the back gesture.
- One `nav()` helper feeds both the Sider and the Drawer, so the two can never drift apart.
- `minWidth: 0` on the inner flex `Layout`. Load-bearing: a flex child defaults to `min-width: auto`,
  so the admin table would otherwise stretch the column and push the menu trigger off-screen.
- Header buttons are 44×44 on a phone, the app name moves into the header (the Sider that used to
  carry it is gone), and the user's name is dropped — the avatar already says who is signed in.

## The bug underneath: the drawer opened and stayed off-screen

The Drawer mounted, got `ant-drawer-open`, and sat at `transform: matrix(1,0,0,1,260,0)` — exactly
its own width outside the viewport. A menu button that does nothing.

Ruled out first: placement. Both `left` and `right` stuck, so it was not an RTL mistake.

**The cause was `global.css`.** This browser has `prefers-reduced-motion: reduce` on, and the file
crushes `transition-duration` to `0.001ms !important` for `*`. AntD opens a drawer by *removing* the
closed transform, and it only removes it when the transition **ends**; rc-motion attaches that
`transitionend` listener one frame later, by which time a 0.001ms transition has already fired. The
event is never heard, so the transform is never cleared.

My first fix was wrong and I want that recorded: I restored the duration for `.ant-drawer, .ant-drawer *`
inside the media query. **Measured — it does not work.** Restoring it globally does, but that throws
the preference away for everyone. The correct fix is to stop the library animating at all:

```ts
// tokens.ts
export function buildTheme(mode: ThemeMode, reducedMotion = false): ThemeConfig {
  return { algorithm: …, token: { motion: !reducedMotion, … } }
```

fed by a `usePrefersReducedMotion()` hook in `providers.tsx` that keeps listening, so toggling the OS
setting takes effect without a reload. With `motion: false` there is no transform to strand — the
panel simply appears, which is what "reduce motion" should mean.

## room-web has the same bug

`room-web/src/theme/global.css` carries the identical blanket block, and
`room-web/src/features/meeting/MeetingScreen.tsx` renders a `Drawer` for the participants/chat panel.
Same two-line fix applied there.

I verified the failure and the fix in `vms-web` directly; I have **not** driven room-web's meeting
drawer, which needs a live meeting. The CSS and the AntD version are the same, so I am confident in
the diagnosis but the room-web fix is untested in the browser.

`election-web` and `mun-sanandaj-web` carry the same blanket CSS but render no `Drawer` and no
`Modal` — nothing to strand, so they are left alone.

## Verified in the browser

At **375 px**, reduced motion still on:

| Check | Result |
|---|---|
| Drawer visible on open | yes — `transform: none` |
| Position | `left: 115, right: 375` — flush right, RTL-correct |
| Closes on mask tap / on navigate | yes / yes |
| `aria-expanded` tracks open state | yes |
| Trigger hit area | 44×44 |
| Page overflows sideways | no |

At **1280 px**: Sider present at 240 px, toggle collapses it to 80 and back, brand text hides when
collapsed, no Drawer rendered, header does not duplicate the app name.

One trap worth knowing for next time: the preview pane's **emulated resize does not fire `matchMedia`
listeners**, so `Grid.useBreakpoint()` kept reporting mobile at 1280 even though
`matchMedia('(min-width: 768px)').matches` was `true`. That looked exactly like a broken breakpoint
hook. A fresh page load at the target width is the honest way to check the other side of a breakpoint.

## Housekeeping

The temporary route-guard bypass from the previous task (`VITE_DEV_BYPASS_AUTH` in `auth/routes.tsx`
plus `vms-web/.env.local`) is **reverted and gone** — `grep` for `DEV_BYPASS` and `TEMP-LOCAL` across
`vms-web` returns nothing, and `.env.local` no longer exists.

`vms-web` and `room-web`: typecheck, lint and production build all clean.

## Deployed

`vms-web` and `room-web` rebuilt and recreated on the production box; both **healthy**, and the API
and Traefik containers were not touched. Confirmed against the live sites through the CDN:

| Live check | vms | room | election (control) |
|---|---|---|---|
| HTTP | 200 | 200 | 200 |
| reduced-motion hook in the JS bundle | **1** | **1** | 0 |
| mobile menu aria-label «باز کردن منو» | **1** | 0 (has no mobile drawer) | – |
| AntD Drawer in the bundle | 1 | 1 | – |

election-web reading 0 is the control: it was deliberately left alone, so a non-zero there would have
meant I had changed something I did not intend to.

## Still open

- room-web's meeting drawer is fixed but unverified in a browser (needs a live meeting).
- Unchanged from the last record: **production still has 0 cameras**, so the wall is empty by
  definition, and I have still never seen the signed-in UI.
