# VMS — the first real camera, and the WebSocket go2rtc would not open

- **Date:** 2026-08-03
- **Area:** VMS — `deploy/vms/base.yaml` and the media VPS (`185.182.220.182`)
- **Branch / commits:** `main`
- **Status:** **fixed and deployed.** The full chain is proven end to end for the first time.

## What happened

Amir added the first camera through the panel — «دوربین اول», بیجار, `78.39.233.70` — and the tile
showed «بی‌ارتباط / آخرین اتصال: هنوز بررسی نشده».

Everything except the last hop was already working, which is why this looked worse than it was:

| Link in the chain | State |
|---|---|
| Camera row → `/api/VmsGateway/config` | HTTP 200, 1 camera, 1 credential |
| `vms-sync` → `go2rtc.yaml` | wrote `bijar-01: rtsp://…@78.39.233.70:554/mode=real&idc=1&ids=2` |
| go2rtc restart | clean |
| VPS → camera `:554` | open |
| Health sweep | **1 up, 1 recorded** at 01:06:37 |
| Browser → go2rtc WebSocket | **refused** |

The screenshot was simply taken before the 01:06 sweep — «هنوز بررسی نشده» was already stale. The
real fault was one line in go2rtc's log:

```
ERR ws.go:106 > host=cam.myceo.ir origin=https://vms.myceo.ir
    error="websocket: request origin not allowed by Upgrader.CheckOrigin"
```

## Cause

The player is served from `vms.myceo.ir`; the stream comes from `cam.myceo.ir`. Every MSE WebSocket
therefore arrives with an `Origin` that is not go2rtc's own host, and go2rtc's default
`Upgrader.CheckOrigin` rejects it outright. **This was designed in from step 6** — the split-host
architecture is deliberate, so the browser fetches video straight from the media VPS instead of
proxying it through the production box. Nothing had exercised the WebSocket until a real camera
existed, so it never surfaced.

## Fix

`origin: "*"` under `api:` in `deploy/vms/base.yaml`, installed to `/srv/vms/base.yaml` and picked up
by re-running `vms-sync`.

`"*"` is go2rtc's only setting here; there is no allow-list. It is acceptable because it is not what
protects this port:

- Traefik routes **exactly one path** to the container — `/api/streams`, which echoes camera
  passwords, is not routed at all (verified: 404).
- Traefik calls the API's forwardAuth before go2rtc sees anything (verified: 401 with no cookie).
- The media cookie is scoped to `.myceo.ir` with `SameSite=Lax`, so a genuinely third-party page
  cannot send it and its upgrade is rejected before it reaches go2rtc.

## Verified

Probed from a sidecar container on the docker network:

| Check | Result |
|---|---|
| WS upgrade, `Origin: https://vms.myceo.ir` | **101** (was refused) |
| `/api/stream.mp4?src=bijar-01&video=h265` | **200, 221 067 bytes, `video/mp4; codecs="hvc1.1.6.L153.B0"`** |
| Public WS path, no cookie | 401 |
| Public `/api/streams` | 404 — not routed |
| Public `/` on cam.myceo.ir | 404 |
| Port 1984 on the VPS / the camera site / cam.myceo.ir | closed everywhere |

The 221 KB of H.265 is the part that matters: that is real video, pulled from the camera, through
go2rtc, over the path the player uses. Steps 1 through 9 are now proven together.

## Three traps this cost time on

- **You cannot curl go2rtc from the VPS host.** Docker Desktop keeps containers in a VM, so both
  `127.0.0.1:1984` and the container's bridge IP return `000` — indistinguishable from "the service
  is dead". My first two probe scripts were measuring nothing.
- **The go2rtc image is distroless.** No shell, no `wget`; `docker exec` fails with `executable file
  not found`, which reads like a broken container. Use a sidecar:
  `docker run --rm --network traefik --entrypoint sh curlimages/curl:latest -c "curl …"`.
- **`/api/frame.jpeg` returns 500 `exec: "ffmpeg": executable file not found`** and that is harmless
  — JPEG needs a transcode the image does not ship. It looked like the camera was failing. Use
  `/api/stream.mp4` to test the real path.

## A note on the router

Amir port-mapped 1984 on a router while we were debugging. It was not needed — Traefik reaches
go2rtc over the docker network — and it is checked closed from outside on all three candidate hosts.
**It should be removed.** Anything that can reach 1984 directly can read `/api/streams`, and that
response contains every camera's password in clear text.

## Still open

- Only one camera exists. The «~0.41 Mbit/s per site» question from step 1 still needs two or three
  more camera IPs to settle.
- I have still never seen the signed-in UI — I do not complete browser logins that need a password,
  so the last visual confirmation is Amir's.
