# VMS — «سرویس تصویر در دسترس نیست», and a mobile pass

- **Date:** 2026-08-03
- **Area:** VMS — `src/Web/DependencyInjection.cs`, `vms-web`
- **Branch / commits:** `main`
- **Status:** **fixed and deployed.**

## The error on screen

Amir opened `vms.myceo.ir` and got «سرویس تصویر در دسترس نیست / ارتباط با سرویس تصویر برقرار نشد».

**Cause: the API's CORS policy had no `AllowCredentials()`.** Confirmed against the live API rather
than guessed:

```
Origin: https://vms.myceo.ir  →  Access-Control-Allow-Origin: https://vms.myceo.ir
                                 (no Access-Control-Allow-Credentials)
```

The origin was allowed — the `Cors__AllowedOrigins__10` entry bound correctly — but `vms-web` is the
**only** SPA that sends `credentials: "include"`, and it has to: `/api/VmsMedia/session` answers with
a `Set-Cookie` the browser must keep, and a browser discards a cookie from a cross-origin response
unless that response also says `Access-Control-Allow-Credentials: true`. So the fetch was rejected
before any code saw it, and `useMediaSession` reported it as a connection failure — which is exactly
what it looked like.

Safe to add here because the origin list is explicit: `WithOrigins` echoes only the configured hosts,
and ASP.NET refuses `AllowCredentials` alongside `AllowAnyOrigin`, so this cannot silently widen if
the list is ever replaced by a wildcard.

## Two more bugs the same report uncovered

Amir also said the working form is
`stream.html?src=…&mode=mse&video=h265`. That is a real difference from what the player was doing.

1. **The player never sent `video=`.** Without it go2rtc negotiates all three tracks the cameras
   publish — H.265 video, PCMA audio and an ONVIF metadata track — and MSE receives the init segment,
   reports the right dimensions, and then paints nothing. Now `video=h265,h264`. Both codecs, not
   just H.265, so a camera switched to H.264 later does not go dark because the string was pinned to
   what the estate happened to publish that week. The offered codec list also dropped `mp4a.40.2`:
   offering an audio codec and then filtering audio out is a contradiction that fails silently.
2. **The fullscreen modal passed `muted={false}`.** On a stream with no audio at all, the only thing
   that achieves is giving the browser grounds to refuse autoplay. The prop is gone; the player is
   always muted.

## The mobile pass

Amir asked for this to be standard for every service from now on, so it is now a memory:
**check each page and each component at phone width — tables, inputs, cards, modals.**

Every route here is Administrator-only, so to actually look at the pages I bypassed the route guards
**locally and temporarily** (a `VITE_DEV_BYPASS_AUTH` flag plus a `.env.local`), stubbed the two API
calls in the browser so the screens had realistic content, and reverted both before committing —
`grep` for the flag confirms nothing was left behind.

| Checked at 375 px | Result |
|---|---|
| Camera wall, 9 tiles | no page overflow; one tile per row |
| **Tile caption** | **bug — the city label collapsed to 15 px**, present but unreadable |
| Admin table | **910 px wide, 7 columns, in a 325 px window** |
| Camera form, 10 fields | clean; no control overflowed its column |
| Fullscreen modal | fits (359 px in 375); `width="min(1100px, 96vw)"` behaves |
| Pagination | renders |

### What changed

- **Tile caption:** `flexShrink: 0` on the city and `minWidth: 0` on the name. A flex item defaults
  to `min-width: auto`, so without that the long name refused to shrink and crushed its neighbour
  instead of ellipsing itself.
- **Admin table: 910 px → 478 px on a phone, with nothing lost.** شهر hides below `md`, آدرس and
  جریان اصلی below `lg`, وضعیت below `sm` — and the information they carry moves into the name cell
  for exactly those widths (`baneh-01 · بانه · غیرفعال`). The «غیرفعال» marker only appears when it
  is true, because "active" is the unremarkable default and an admin scanning a phone needs to see
  the exception.
- The inline city is gated by one CSS rule at `max-width: 767.98px`, matched to AntD's `md`. Verified
  at 768 px: the columns come back and the inline copy computes to `display: none`, so it never shows
  twice.
- The name column is bounded (`ellipsis`, `width: 220`) with the full name in a tooltip; otherwise a
  long camera name widened the whole table under `max-content` sizing.

478 px still needs one short sideways swipe inside the table's own scroller. The page body never
scrolls sideways, which is the rule that matters.

## Verification

- Live: `Access-Control-Allow-Credentials: true` on both the request and the preflight for
  `/api/VmsMedia/session`; `vms.myceo.ir` still 200 and its bundle carries `h265,h264`; room and
  welfare unaffected.
- `vms-web` typecheck, lint and build clean. Functional **202 passed / 3 failed** — the same three.

## Still open

- **No camera has been added through the panel.** Production has 8 cities and **0 cameras**, so the
  wall is empty by definition. بیجار was tested straight against go2rtc, not through the service.
- The wall with real video, signed in, remains unseen by me for the reason in step 6.
