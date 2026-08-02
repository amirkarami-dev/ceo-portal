# VMS — video management service — design

> **Date:** 2026-08-01 · **Status:** step 1 done (2026-08-02), steps 2–9 not started · **Author:** Amir + Claude
> Live camera viewing at **vms.myceo.ir**, cameras classified by city.
>
> **Step 1 overturned three assumptions in this document.** §2.2, §2.3 and §3 have been rewritten and
> the corrections are marked inline rather than silently applied — the reasoning that was wrong is
> worth keeping next to the reasoning that replaced it.

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

### 2.2 The camera's own upload is the ceiling — not the VPS's

> **Corrected 2026-08-02 by step 1.** This section originally said the VPS's 44–62 Mbit/s upload was
> the binding constraint. It is not, and it is not close. The real limit is **each camera site's own
> internet upload**, which on the first camera measured **~0.41 Mbit/s**.

Measured from the VPS against `78.39.233.70`, over plain HTTP with no RTSP involved — three runs of a
161 KB file served by the camera itself:

| Run | Result |
|---|---|
| 1 | 161 053 bytes in 3.14 s → **51.3 KB/s** |
| 2 | 161 053 bytes in 3.13 s → **51.5 KB/s** |
| 3 | 161 053 bytes in 3.18 s → **50.6 KB/s** |

RTT 58 ms, 0 % packet loss. So the site delivers about **0.41 Mbit/s, full stop** — for every viewer,
every stream, combined.

Against that ceiling:

| Stream | What it is | Needs | Fits in 0.41 Mbit/s? |
|---|---|---|---|
| `ids=1` main | H.265, 2560×1440, 9 fps | **~11.2 Mbit/s** | **no — 27× over** |
| `ids=2` sub | H.265, 704×576, 9 fps | **~354 kbit/s** | **yes, just** |

ffmpeg needed **330 seconds of wall clock to pull 15 seconds** of the main stream — a realtime factor
of 0.045. The substream pulled **40 seconds of media in 42 seconds** of wall clock: realtime factor
**~0.95**, which is live.

Three consequences, and they are the product:

1. **The main stream is not viewable from this site at all.** Not in a grid, not fullscreen, not for
   one person. "Fullscreen switches to the main stream" — the original §7 step 7 — cannot be built
   until a site's uplink improves. Fullscreen has to mean *a bigger tile of the same substream*.
2. **The substream has no headroom.** At ~354 kbit/s against ~410 kbit/s it is already at ~86 % of the
   link. A second concurrent puller of the same camera would break both. This is the strongest
   argument yet for the gateway: **exactly one** connection per camera, ever.
3. **The VPS is nowhere near its limit.** Twenty cameras × 0.41 Mbit/s ≈ 8 Mbit/s inbound; fanning
   nine tiles out to four admins is ~13 Mbit/s outbound, against 44–62 measured. The wall is at the
   cameras, not here.

### 2.3 These cameras serve plenty of viewers — the gateway is for the uplink

> **Corrected 2026-08-02 by step 1.** This section originally assumed the OEM stack would allow only
> a handful of simultaneous RTSP sessions. It was wrong: **12 concurrent PLAY sessions were held on
> the main stream without a single refusal**, and the test stopped at 12 only because that was the
> limit of the loop.

So the camera is not the session bottleneck. **The gateway is still mandatory, but for §2.2's reason
rather than this one:** the site has ~0.41 Mbit/s of upload, the substream eats ~86 % of it, and a
second simultaneous pull starves both. go2rtc holds *one* connection per camera, fans it out to every
browser, and drops it when the last viewer leaves. Ten people watching one camera must never mean two
RTSP sessions to it, let alone ten.

## 3. The stream URL — found 2026-08-02

```
rtsp://admin:<password>@<host>:554/mode=real&idc=<channel>&ids=<stream>
```

| | |
|---|---|
| **main** | `…/mode=real&idc=1&ids=1` — H.265, 2560×1440, 9 fps, ~11.2 Mbit/s |
| **sub** | `…/mode=real&idc=1&ids=2` — H.265, 704×576, 9 fps, ~354 kbit/s |
| **jpeg** | `…/mode=real&idc=1&ids=4` — RTP/JPEG; neither go2rtc nor ffmpeg could consume it |

Two quirks that any client must satisfy:

- **The `Authorization` header is required.** Credentials in the URL userinfo alone return `401`. Both
  go2rtc and ffmpeg send the header automatically given `rtsp://user:pass@…`, so this only bites
  hand-rolled clients.
- An optional `&unicast=true` is accepted; `&unicast=false` (multicast) returns `404`.

### Why no amount of guessing would have found it

The design originally assumed a credentialled sweep of common OEM paths would work. It would not
have, and this is worth keeping:

| Verb | Real path | Nonsense path |
|---|---|---|
| `OPTIONS` | 200 | **200** — the URI is ignored entirely |
| `DESCRIBE` | 200 | **400** — never 401, never 404 |

Neither verb discriminates: `OPTIONS` answers 200 for `/nonsense-zzz`, and `DESCRIBE` answers 400 for
every wrong path whether or not credentials are supplied. **51 candidate paths were tried across four
sweeps and every single one returned 400**, including the textbook Xiongmai
`/user=admin&password=…&channel=1&stream=0.sdp?real_stream`.

What actually worked was **reading the device's own web UI**. `http://<cam>/js/Common.js` contains
`geturlStr()`, which builds the URL the camera's own player uses. The same function emits a
`quii://` scheme for its ActiveX path — which is where the `QV RTSP Server` banner comes from.

**The lesson for the other sites: check `js/Common.js` before probing.** The device will tell you.

### 3.1 It is H.265, and that decides the transport

Both video streams are **H.265 (HEVC)**, alongside PCMA audio and an ONVIF metadata track. The design
had assumed H.264. This settles a question §6 had left open:

| Transport | H.265? | Verdict |
|---|---|---|
| **MSE over WebSocket** | yes, where the browser has a hardware HEVC decoder | **use this** |
| WebRTC | **no** — Chrome does not do HEVC over WebRTC | ruled out |
| HLS | yes, but re-authorises every segment (§4) | no |

**Verified, not assumed:** Chromium 148 on Windows reports `hvc1` and `hev1` supported in MSE, and the
substream played through go2rtc for 23 seconds continuously — a canvas grab off the `<video>` element
returned a real picture with a full luminance range, at 1024×576 display size.

Two things follow:

- **UDP 8555 does not need forwarding.** WebRTC is out, so MSE over the VPS's existing 443 is the only
  transport, exactly as §6 recommended — now for a hard reason rather than a latency preference.
- **HEVC support must be checked on the admins' actual machines.** It needs a hardware decoder;
  Chrome on a machine without one will show a black tile. If that turns out to be a problem, the
  fallback is transcoding H.265→H.264 on the VPS (ffmpeg is now installed there), which costs real
  CPU per stream and should be a last resort. Better first move: **ask whether the cameras can be set
  to H.264** in their own encode settings.

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
| `Channel`, `SubStreamId` | the `idc` and `ids` of §3 — stored, because the next camera model will spell them differently |
| `IsActive` | |
| `LastSeenUtc?` | written by the scheduled sweep, read by the UI — never probed on page load |

`HasSubStream` is gone. Step 1 showed the substream is not an optimisation the grid *may* use — it is
the only stream the site's uplink can carry (§2.2), so a camera without one cannot be shown at all.
That is an `IsActive = false` situation, not a display mode.

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

**Ports: nothing new to forward.** 443 on the VPS is already open and proven (that is how
`lk.myceo.ir` serves), and §3.1 rules WebRTC out because the cameras are H.265 — so **UDP 8555 is not
needed**. MSE over 443 is the whole transport story.

## 7. Build order

| # | Step | Done when | Status |
|---|---|---|---|
| 1 | Confirm one camera end to end: find the RTSP path, main + substream, and how many sessions it tolerates | go2rtc on the VPS plays one camera in a browser | **done 2026-08-02** |
| 2 | `Cameras` + city model + migration | a camera exists in `CeoDb` | |
| 3 | Admin CRUD, by city | a camera can be added and tagged | |
| 4 | go2rtc config generated from the database, run as a service | adding a camera does not mean hand-editing YAML | |
| 5 | Traefik forwardAuth against the API | an unauthenticated stream request is refused | |
| 6 | `vms-web`: city list → paged camera grid on substreams | an admin sees live video, filtered by city | |
| 7 | Fullscreen = a bigger tile of the **same substream**, plus a one-viewer-per-camera cap | no camera is ever pulled twice at once | rescoped by §2.2 |
| 8 | Scheduled health sweep + «آخرین اتصال» per camera | a dead camera is visible as dead, not as a black square | |
| 9 | Deploy: compose, OIDC client, CORS, DNS, AppSwitcher ×8 | `https://vms.myceo.ir` serves it | |

Step 7 changed. It was "fullscreen on the main stream, with a concurrency cap"; the main stream needs
27× the bandwidth the site has, so fullscreen shows the substream larger and the cap protects the
camera's uplink rather than the VPS's.

## 8. Decisions (answered 2026-08-01)

| Question | Answer | What follows from it |
|---|---|---|
| Recording? | **Live only** | go2rtc connects only while somebody is watching. No disk, no retention policy — and the bandwidth argument in §2.2 holds, because it depends on exactly that. |
| Who may watch? | **Administrators only** | No per-user city table. `forwardAuth` reduces to one check: does this session carry the `Administrator` role. City is classification and filtering, not permission. |
| How many cameras? | **20–100** | Two consequences below. |

### What 20–100 cameras changes

- **The grid pages.** Not for the VPS's sake — twenty substream tiles is only ~8 Mbit/s inbound — but
  because tiles that scroll out of view must disconnect, so a camera is never held open for nobody.
  A page of **at most 9** remains the right shape.
- **Health checking is scheduled, not fanned out on page load.** Probing 100 cameras every time
  somebody opens the site would be 100 outbound connections per visit. A background sweep on a slow
  interval writes `LastSeenUtc`, and the UI reads that column. With §2.2's numbers this matters more,
  not less: a health probe is a *second* puller, so the sweep must skip any camera currently being
  watched.
- **The concurrency cap survives, with a different job.** It is no longer about the VPS's 44–62
  Mbit/s. It is **one puller per camera**, because the camera's own 0.41 Mbit/s cannot serve two.

### The four unknowns — answered by step 1

| # | Question | Answer |
|---|---|---|
| 1 | The RTSP stream path | **Found** — §3. Read out of the device's own `js/Common.js`, not guessed. |
| 2 | Does a substream exist, and at what resolution? | **Yes: 704×576 @ 9 fps, ~354 kbit/s** — and it is the *only* usable stream, because the 2560×1440 main needs 27× the site's uplink. |
| 3 | How many simultaneous RTSP sessions? | **At least 12**, no refusal. The original worry was unfounded — but §2.2 means the practical answer is still *one*. |
| 4 | Does every camera share one credential? | **Still unknown.** Only one camera has been seen. Step 3's admin CRUD must allow a per-camera credential rather than one global one. |

### New unknowns that step 1 created

1. **Is ~0.41 Mbit/s typical of every site, or is this one bad?** This is now the single most
   important question about the product. If every site is like this, the whole service is a wall of
   704×576 tiles and fullscreen main-stream viewing never happens. **It needs measuring at two or
   three more sites before step 2.**
2. **Can the cameras be switched to H.264, and can the substream bitrate be capped?** Both are
   settings in the camera's own UI. H.264 would remove the hardware-decoder risk in §3.1; a cap
   around 250–300 kbit/s would give the substream headroom inside the 0.41 Mbit/s link instead of
   sitting at 86 % of it.
3. **Does the camera have more than one channel?** `idc=1..4` all answer, but `idc=2` delivered a
   different init segment and far less data. Probably the RTSP server accepting any channel number on
   a single-sensor camera; worth one check before the data model assumes one row per camera.

## 9. Not in v1

PTZ control, two-way audio, motion detection, analytics, mobile push. None was asked for, and each is
a service of its own.
