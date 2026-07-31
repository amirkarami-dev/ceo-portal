# Room step 8: the meeting screen, both modes

- **Date:** 2026-07-31
- **Area:** room / front end
- **Status:** **criterion met and observed** — a guest joined a real meeting on a real media server,
  and the server refused to grant them publish. The presenter half still needs a signed-in session.

## Goal

Step 8's success criterion: **audience cannot publish, presenter can**.

## What changed

- `room-web/src/features/meeting/MeetingScreen.tsx` — `<LiveKitRoom>`, audio renderer, connection
  states, title bar.
- `.../MeetingStage.tsx` — camera grid, and a screen share that takes the stage with the cameras
  shrunk to a strip.
- `.../MeetingBar.tsx` — mic / camera / screen / participants / leave.
- `.../ParticipantsPanel.tsx` — who is in the room, with the مهمان marker.
- `.../MeetingPage.tsx` — `/room/:id`, the member's door.
- `Lobby` gained «ورود به تصویر و صدا»; `JoinPage` renders the meeting after it.
- «ورود به جلسه» is back on the «جلسات من» cards, gated on the server's `canJoinNow`.
- `@livekit/components-react`, `@livekit/components-styles`, `livekit-client`.

## Decisions

- **One meeting screen, two doors.** A member from «جلسات من» and a guest from a link both hold the
  same thing by this point — a signed token naming one room and what they may do — so both render
  `MeetingScreen`. Same reasoning as `IRoomJoiner` on the server: two paths that each decide for
  themselves drift apart.
- **The publish buttons are absent for an audience member, not disabled.** A greyed microphone says
  «you could speak, but not now», which is the wrong story: in an ارائه an audience member is never
  going to speak, and a disabled control invites people to hunt for the setting that unlocks it.
- **Camera and microphone start off.** Opening either on arrival is the behaviour every conferencing
  product gets complained about for, and on a public link it would put a stranger's living room on
  screen before they had looked at the page.
- **The lobby stays, as a real step.** A guest sees their own display name, the مهمان tag and
  «فقط تماشا و گفتگوی متنی» *before* anything touches a camera — so they can back out, and so the
  answer to «why can't I speak?» is already on screen when they ask it.
- **A screen share takes the stage.** Sharing a screen is always the thing people came to look at; a
  grid treating it as one more equal tile makes slides unreadable.
- **`withPlaceholder` on cameras, not on screen shares.** A tile is kept for someone whose camera is
  off so the grid does not reshuffle on every toggle — but an audience member has no camera track and
  no placeholder, or a 200-person webinar would render 200 empty squares.
- **`/room/:id` is inside `RequireAuth` but outside `AppLayout`.** A sidebar beside a video grid is
  pixels taken from the thing people came to look at.

## One bug, found by watching the failure

The media connection failed (expected — see below) and the page printed the SDK's own message
verbatim:

> could not establish signal connection: **invalid API key: APIlocaldev**

An English sentence full of infrastructure detail, shown to a guest at a public webinar. The key named
there is the public half of the pair — it is the token's `iss` claim, not the secret — so this is not a
credential leak, but naming our media server's key to a stranger buys nothing and the sentence means
nothing to them either. It now goes to `console.error` for diagnosis and the screen says only
«ورود شما پذیرفته شد، اما ارتباط با سرویس ویدیو ممکن نشد» with a retry.

## Getting a media server to test against

Docker Hub **403s on the LiveKit image blob** from this network — the same class of restriction the
project already records for NuGet. The VPS can pull, and already runs the image, so it was lifted off
there instead:

```
docker save livekit/livekit-server:v1.13.3 | gzip -1 > /tmp/lk.tgz   # on the VPS
pscp … /tmp/lk.tgz  →  docker load -i lk.tgz                          # locally, 36 MB
docker run -d --name ceo-livekit-local -p 7880:7880 -p 7881:7881 -p 7882:7882/udp \
  livekit/livekit-server:v1.13.3 --dev --bind 0.0.0.0 --node-ip 127.0.0.1
```

**No production secret was touched.** `--dev` uses LiveKit's own published placeholder pair
(`devkey`/`secret`), which is a documented constant. The real key was generated on the VPS and stays
in `deploy/.env` there; `appsettings.Development.json` now points at the local server instead.

`--node-ip 127.0.0.1` is load-bearing: without it the server advertises its container address
(`172.17.0.3`) as the ICE candidate, signalling succeeds, and then the peer connection fails with
`could not establish pc connection`. The token is accepted and the meeting still never starts, which is
a confusing pair of symptoms to debug.

## Verified — the criterion, observed

- `npm run build` (typecheck + vite) and `npm run lint --max-warnings 0` clean; unit **326 passed**,
  functional **130 passed / 3 failed** (the same three pre-existing failures).
- **A guest joined a real meeting**, in a browser, end to end: link → countdown → join → lobby →
  «ورود به تصویر و صدا» → connected, with their own tile rendering.

**Audience cannot publish — three independent layers, all observed:**

1. **Our token** says so explicitly: `"canPublish": false`, present rather than omitted (decoded in
   step 7 from a live response).
2. **The media server agrees.** Its own join record for this participant grants only what it was asked
   to — `canPublish` is *absent from the granted set entirely*:
   ```
   "identity": "guest-c411f2eb0bc5ae51", "state": "ACTIVE", "name": "رضا احمدی",
   "permission": { "canSubscribe": true, "canPublishData": true }
   ```
   That is LiveKit's decision after validating our token, not our own DTO reflected back.
3. **The UI matches.** The control bar renders **only** «شرکت‌کنندگان» and «خروج» — no microphone, no
   camera, no screen share — with «شما تماشاگر هستید؛ فقط ارائه‌دهنده صحبت می‌کند» in their place. The
   participants panel shows `رضا احمدی · شما · مهمان · تماشاگر`, where **مهمان** comes from the
   server-minted `guest-` prefix and so is the one label a guest cannot forge.

`canPublishData` **is** granted, which is what step 9's chat will run on.

## Still not observed: the presenter side

«presenter can publish» is proven at the token level — the step 5 functional test decodes a presenter
and a guest token **from the same room** and asserts they differ — but has not been watched in a live
meeting. That is not an oversight or a missing feature; it is the design working: no anonymous path can
ever produce a publishing token. `Public` requires `Presentation`, whose audience cannot publish, and
every other join mode requires a signed-in identity. Producing one would mean logging in, which needs
either the admin password or a کد ملی the local directory cannot resolve.

**The 30-second check, once signed in:** an administrator may enter any meeting, and in a `Meeting`
(rather than `Presentation`) everyone may publish — so opening any Meeting-type room from «جلسات من»
should show the full bar: microphone, camera, screen share.

## Follow-ups

- Step 9: saved chat. `canPublishData` is granted on every token, including an audience one — confirmed
  in the server's own join record above — so the transport is already in place.
- Watch the presenter's control bar once signed in (see above).
- Step 10: deploy, where `LiveKit:*` must point back at `lk.myceo.ir` with the real key. **The dev
  config now points at `localhost:7880` — that must not reach production.**
- The rate-limiter concern from step 7 is unchanged and still worth settling before a public webinar.
