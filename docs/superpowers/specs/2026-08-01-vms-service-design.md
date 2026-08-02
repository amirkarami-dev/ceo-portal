# VMS — video management service — design

> **Date:** 2026-08-01 · **Status:** design, NOT started · **Author:** Amir + Claude
> Live camera viewing at **vms.myceo.ir**, cameras classified by city.

---

## 1. What it is

Admins register IP cameras, each tagged with the city it sits in
(بانه، مریوان، سقز، دهگلان، کامیاران، قروه، بیجار، دیواندره). Users open the site and watch live
video, filtered by city.

## 2. The three constraints that decide the architecture

### 2.1 A browser cannot play RTSP. Something must translate.

No browser speaks RTSP. A gateway has to pull RTSP from the camera and republish it as something a
browser understands — WebRTC, MSE-over-WebSocket, or HLS. **go2rtc** does all three, is a single Go
binary, and does **H.264 passthrough** so there is no transcoding cost.

### 2.2 The VPS upload is the hard ceiling — and it is already measured

From the room-service work on the same machine (`185.182.220.182`): **upload 44–62 Mbit/s**, measured
twice. Every viewer's stream is VPS *upload*. Pulling from cameras is download, which is not the
problem.

That number sets the whole product:

| What someone is watching | Rough cost | Concurrent viewers before saturation |
|---|---|---|
| One camera, substream (~0.5–1 Mbit/s) | 1 Mbit/s | ~50 |
| One camera, main stream (~2–4 Mbit/s) | 3 Mbit/s | ~15 |
| A 9-camera grid on substreams | 9 Mbit/s | **~5** |
| A 9-camera grid on main streams | 27 Mbit/s | **~2** |

So: **the grid must use substreams, and only a fullscreen camera gets the main stream.** This is not
an optimisation to add later — get it wrong and the third person to open a wall breaks it for
everyone. Re-measure before any large rollout; the room worklog records that an earlier estimate of
500 Mbps was wrong by an order of magnitude.

### 2.3 These cameras cannot serve many viewers directly

`QV RTSP Server v0.1.0.0` is a low-end OEM stack (Briton and others rebadge it). Stacks in this class
typically allow only a handful of simultaneous RTSP sessions, sometimes as few as one on the main
stream.

**So the gateway is structural, not a convenience.** go2rtc holds *one* connection per camera and fans
it out to every browser, and drops the camera connection when the last viewer leaves. Ten people
watching one camera must never mean ten RTSP sessions to it.

## 3. Probed, not assumed

Run from the VPS — the machine that will actually pull the streams, so this proves the real path:

| Check | Result |
|---|---|
| `78.39.233.70` ports 80 / 443 / 554 from the VPS | **all open** |
| RTSP banner | `QV RTSP Server(v0.1.0.0)` |
| RTSP methods | `OPTIONS, DESCRIBE, SETUP, TEARDOWN, PLAY, GET_PARAMETER, SET_PARAMETER` |
| `OPTIONS rtsp://…:554/` | **200** |
| `DESCRIBE` on 31 common OEM stream paths, unauthenticated | **400 on every one** |

That last row matters. A compliant server answers **401** for a real path with no credentials and
**400** for a nonsense one, which would have mapped the device without ever using the password. This
one answers 400 to everything.

**Consequence: the stream path can only be found with credentials, and must be confirmed per camera
model.** It is the first thing step 1 does.

## 4. Shape

```
browser ──── https://vms.myceo.ir ─────────► main box   (SPA, camera list, who may watch)
   │
   └──────── wss://cam.myceo.ir ──────────► VPS: go2rtc ──── RTSP ───► cameras (public IPs)
                    ▲
                    └── Traefik forwardAuth ──► api.myceo.ir  (is this person allowed?)
```

**Media never touches the main box.** Same decision as the room service, for the same reasons: the
main box already runs ~30 containers on 8 cores, and video is the workload that will not tolerate a
noisy neighbour.

### Why forwardAuth rather than go2rtc's own password

go2rtc can require basic auth, but then every viewer's browser holds that one credential — which is
the same as having none. Instead Traefik on the VPS calls **our** API before letting a stream request
through: it carries the user's session, our API answers 200 or 403, and go2rtc is never reachable
without that. Authorisation stays in the API where the city permissions live; media stays on the VPS.

This also argues for **WebRTC or MSE over HLS**: those authorise once at the handshake, whereas HLS
would re-authorise on every segment.

### Credentials never reach the database

The camera passwords live **only** in go2rtc's config on the VPS (`chmod 600`), exactly like the
LiveKit secret. The database stores a camera's *go2rtc stream name*, never its password. Nothing in
the repo, nothing in `CeoDb`, nothing in an API response.

### A hardening step this design unlocks

Once every viewer goes through the VPS, each camera's port 554 can be restricted to
**185.182.220.182 only**. Today the fleet answers the whole internet; afterwards it answers one
address. Worth doing once the gateway is proven — it is a firewall change per site, not a code change.

## 5. Data model

**`Cameras`** — `BaseAuditableEntity`

| Column | Notes |
|---|---|
| `Id` | |
| `Name` | «دوربین ورودی شهرداری» |
| `CityCode` | see below |
| `Host`, `Port` | `78.39.233.70`, `554` |
| `StreamKey` | the go2rtc stream name, e.g. `baneh-01`. **Not** a URL, **not** a password |
| `HasSubStream` | drives whether the grid can show it |
| `IsActive` | |
| `LastSeenUtc?` | written by the scheduled sweep, read by the UI — never probed on page load |

**City** is a stored **code with a display map**, not a C# enum. The election work taught this the hard
way: a code list that belongs to the organisation should not be frozen into the type system. Adding a
ninth city must be a row, not a deployment.

| Code | City |
|---|---|
| `baneh` | بانه |
| `marivan` | مریوان |
| `saqqez` | سقز |
| `dehgolan` | دهگلان |
| `kamyaran` | کامیاران |
| `qorveh` | قروه |
| `bijar` | بیجار |
| `divandarreh` | دیواندره |

## 6. What you asked about DNS

Two records:

| Host | Points at | CDN | Why |
|---|---|---|---|
| `vms.myceo.ir` | `185.206.94.116` (main box) | **on** (orange) | The SPA. The main box's Traefik cannot issue certificates at all right now — the ArvanCloud DNS API returns 403 — so the CDN must terminate TLS, as it already does for every other host there. |
| `cam.myceo.ir` | `185.182.220.182` (VPS) | **off** (grey) | go2rtc. The VPS issues its own Let's Encrypt certificate over TLS-ALPN, which **cannot complete through the CDN** — this is exactly how `lk.myceo.ir` is set up and it works. |

**Ports:** 443 on the VPS is already open and proven (that is how `lk.myceo.ir` serves). So:

- **MSE / HLS over 443 → no new port forwarding at all.**
- WebRTC would additionally need **UDP 8555** forwarded on the home router, alongside the 7881/7882
  already opened for LiveKit.

**Recommendation: start with MSE over 443.** Latency around half a second to a second, zero firewall
work, and for watching a car park that is indistinguishable from WebRTC. Add WebRTC later only if
something needs sub-300 ms.

## 7. Build order

| # | Step | Done when |
|---|---|---|
| 1 | Confirm one camera end to end: find the RTSP path, main + substream, and how many sessions it tolerates | go2rtc on the VPS plays one camera in a browser |
| 2 | `Cameras` + city model + migration | a camera exists in `CeoDb` |
| 3 | Admin CRUD, by city | a camera can be added and tagged |
| 4 | go2rtc config generated from the database | adding a camera does not mean hand-editing YAML |
| 5 | Traefik forwardAuth against the API | an unauthenticated stream request is refused |
| 6 | `vms-web`: city list → paged camera grid on substreams | an admin sees live video, filtered by city |
| 7 | Fullscreen on the main stream, with a concurrency cap | the wall does not saturate the uplink |
| 8 | Scheduled health sweep + «آخرین اتصال» per camera | a dead camera is visible as dead, not as a black square |
| 9 | Deploy: compose, OIDC client, CORS, DNS, AppSwitcher ×8 | `https://vms.myceo.ir` serves it |

## 8. Decisions (answered 2026-08-01)

| Question | Answer | What follows from it |
|---|---|---|
| Recording? | **Live only** | go2rtc connects only while somebody is watching. No disk, no retention policy — and the bandwidth argument in §2.2 holds, because it depends on exactly that. |
| Who may watch? | **Administrators only** | No per-user city table. `forwardAuth` reduces to one check: does this session carry the `Administrator` role. City is classification and filtering, not permission. |
| How many cameras? | **20–100** | Two consequences below. |

### What 20–100 cameras changes

- **The grid pages.** Twenty tiles on substreams is 20 Mbit/s — a third of the uplink for one viewer.
  The wall shows a page of **at most 9** and pages through the rest; tiles that scroll out of view
  disconnect, which is also what stops the camera holding a session for nobody.
- **Health checking is scheduled, not fanned out on page load.** Probing 100 cameras every time
  somebody opens the site would be 100 outbound connections per visit. A background sweep on a slow
  interval writes `LastSeenUtc`, and the UI reads that column.
- **Concurrency still needs a cap.** Administrators-only keeps viewer count low, but four admins each
  on a 9-tile page is ~36 Mbit/s against a measured 44–62. The cap is a real limit, not paranoia.

### Still unknown — resolved in step 1, with one credentialled probe

1. **The RTSP stream path.** §3 explains why it cannot be found without credentials on this stack.
2. **Whether a substream exists, and its resolution.** Decides whether the grid is viable at all. If
   these cameras are main-stream-only, the wall is roughly three tiles wide before the uplink is gone,
   and the product becomes "one camera at a time" instead.
3. **How many simultaneous RTSP sessions one camera tolerates** — measured by opening connections
   until it refuses. Only matters if go2rtc ever needs to restart while viewers are attached.
4. **Whether every camera shares one credential** or each site has its own.

## 9. Not in v1

PTZ control, two-way audio, motion detection, analytics, mobile push. None was asked for, and each is
a service of its own.
