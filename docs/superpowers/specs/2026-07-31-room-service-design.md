# room service — design

> **Date:** 2026-07-31 · **Status:** design agreed, NOT started · **Author:** Amir + Claude
> **Ported from:** `C:\Projects\vahedgas\vahedgas-portal\vnext` (`room-web`, phases 1 and 2)
> **Revision 2** — rewritten after Amir answered the five open questions and added link-join,
> presentation mode, and scheduled start.

Online video meetings at **room.myceo.ir**, on LiveKit. A working implementation exists in the
vahedgas repo and is the reference; this is a **port with adaptation plus new features**.

---

## 1. Answers that shape the design

| # | Question | Amir's answer |
|---|---|---|
| 1 | Which media server? | **A dedicated one, on his home VPS** `185.182.220.182` (`/srv/sites`, Docker + Traefik already there) |
| 2 | Who may join? | **By link.** Public ⇒ full name only. Private ⇒ کد ملی + SMS OTP, the welfare login |
| 3 | Recording in v1? | **No** — later |
| 4 | Invite picker? | **Not for Presentation meetings** — those have only a join type |
| 5 | Whiteboard / PDF? | **No** — rooms, join, chat |

Plus new requirements:

- **Presentation (one-to-many):** only the **presenter** may use microphone, camera and screen share,
  and has full control. Everyone else watches and listens.
- The presenter is **named by the admin when the meeting is created**.
- The admin sets **public or private**, and whether it can be **joined by link**.
- After creating a meeting, its **join link is shown on the row**.
- A **start time**; before it, joiners see a **countdown**, styled properly.

### Why the dedicated server is the right call

The earlier draft proposed sharing `vng-livekit`, which already runs on the ceo-portal box. Amir's own
server removes the two problems that made sharing uncomfortable:

- **No shared secret.** A LiveKit API secret is not scoped to a room — anyone holding it can mint a
  token for *any* room on that server. Sharing meant the gas-unit product and this one could each reach
  the other's meetings. A separate server ends that completely.
- **No contention.** The ceo-portal box already runs **47 containers** on 8 cores with ~6 GB free.
  Video is the one workload that will not tolerate a noisy neighbour, and it is the one workload whose
  failure everybody notices immediately.

Cost: one more machine to keep alive, and meetings stop if that machine does. Acceptable — the rest of
the portal keeps working, because only the media path lives there.

---

## 2. Where each piece runs

| Piece | Host | Notes |
|---|---|---|
| `room-web` SPA | ceo-portal box | new container, `room.myceo.ir`, behind the CDN ⇒ `myresolver` |
| API (rooms, invites, join, chat) | ceo-portal box | existing `ceo-portal-api`, new endpoints |
| Database | ceo-portal box | existing `CeoDb` |
| **LiveKit server** | **home VPS `185.182.220.182`** | new, `/srv/sites/livekit`, behind that box's Traefik |
| Signalling | `wss://lk.myceo.ir` → home VPS :7880 | needs a DNS record pointing at the home VPS |
| Media | home VPS **7881/tcp + 7882/udp**, open to the internet | must not be proxied |

The API talks to LiveKit two ways: **outbound** over HTTPS for the admin API (create room, list
participants, remove participant), and **never inbound** except the webhook, which LiveKit signs.

---

## 3. Meeting types — the core new model

Two types, and the type decides everything else:

### `Meeting` — everyone equal, invite-gated
Closest to the vahedgas original. An admin picks who may attend; everyone who joins can publish
camera, microphone and screen. No link join. This is the internal-committee case.

### `Presentation` — one-to-many, link-gated
One **presenter**, named by the admin at creation. Everyone else is an audience member:

| | Presenter | Audience |
|---|---|---|
| Microphone, camera, screen | ✅ | ❌ |
| Chat | ✅ | ✅ |
| See and hear | ✅ | ✅ |
| End the meeting, remove people | ✅ | ❌ |

Enforced **in the LiveKit token**, not in the UI: the audience grant carries `canPublish: false`. A
tampered front end cannot turn a viewer's microphone on, because the media server refuses the track.
The UI simply does not draw the buttons.

Audience join is by link, and the link's gate is the **join mode**:

- **`Public`** — enter a full name and join. No account.
- **`Private`** — کد ملی + SMS OTP, the same engineer login the welfare and election services use
  (`/Account/EngineerLogin?service=room`). Only members of the organisation get in.

## 4. The security question this creates, and the answer

A public link that anyone on the internet can open is the largest new risk in this service. Three
things contain it:

1. **Public join is allowed only for `Presentation` meetings.** In that mode the audience token has
   `canPublish: false`, so the worst a gate-crasher can do is watch. A public link into a `Meeting`
   would let a stranger switch a camera on in a committee meeting — so that combination is refused at
   creation, not merely discouraged.
2. **The link is unguessable and revocable.** `JoinToken` is 32 random hex characters on the room row,
   not the room id. Regenerating it invalidates every copy of the old link.
3. **The window is closed by default.** Joining is refused unless the meeting is active, the start time
   has passed (minus a short early-entry grace), and the capacity is not full.

Two smaller ones worth stating:

- **Guests cannot impersonate.** A guest types their own display name, so nothing stops them typing
  «مدیر سازمان». The participant list marks every link-joined guest as **مهمان** and the presenter can
  remove anyone. Names from a کد ملی login come from the organisation's record instead, and are not
  typed.
- **A guest identity is never a member identity.** LiveKit identities are `guest-{random}` for link
  joins and the کد ملی for authenticated ones, so chat authorship and any later audit cannot confuse
  the two.

## 5. Data model — `dbo`, one migration

Adapted to this repo: `BaseAuditableEntity`, the shared `IApplicationDbContext`, one migration history.

**`Rooms`**

| Column | Notes |
|---|---|
| `Id` | int identity |
| `Name`, `Description?` | |
| `Slug` | unique, `ceo-<short>` — the LiveKit room name |
| `Type` | `Meeting` = 0, `Presentation` = 1 |
| `JoinMode` | `InviteOnly` = 0, `Private` = 1, `Public` = 2 |
| `JoinToken` | 32 hex, the link secret; regenerable |
| `PresenterUserId?` | the presenter's **کد ملی** — required when `Type = Presentation`. Must be a کد ملی because an authenticated join carries it as the media identity, and `MayPublish` compares the two exactly |
| `PresenterName?` | read from the organisation's record on save, never typed by the admin |
| `StartsAtUtc` | when joining opens |
| `EarlyJoinMinutes` | default 10 — how long before the start people may enter |
| `DurationMinutes?` | display only in v1 |
| `MaxParticipants` | default 50 |
| `IsActive`, `IsDeleted` | |

Rules enforced at save: `Public` requires `Type = Presentation`; `Presentation` requires a presenter;
`InviteOnly` requires `Type = Meeting`.

**`RoomInvites`** — `(RoomId, UserId)` unique. Only used by `Meeting`.
**`RoomMessages`** — `(RoomId, CreatedAt)`, text ≤ 4000, sender id + name, `IsGuest`.

## 6. API — two groups, split by who may call them

Admin and attendee are **separate endpoint groups**, the same split the election service uses. The
reason is one field: the join link. It is the entire gate for a public presentation, so the DTO that
carries it must never be reachable by a route an attendee can call. One group with a role check inside
it is one forgotten `if` away from handing the key out.

**`/api/RoomAdmin`** — Administrator at the group level *(step 4, built)*

| Route | Purpose |
|---|---|
| `GET /` | every meeting: type, join mode, start time, live head-count, **and the join link on the row** |
| `GET /{id}` | detail, with the invite list |
| `POST /` | create; generates `Slug` + `JoinToken` |
| `PUT /{id}` | edit, including type, join mode, presenter, start time |
| `POST /{id}/link` | new `JoinToken`, old links die; returns the full URL |
| `POST /{id}/active` | open or close the doors; closing also ends the live room |
| `DELETE /{id}` | soft delete, drop the link, end the live room |
| `POST /{id}/invites`, `DELETE …/{userId}` | `Meeting` only, by کد ملی |

**`/api/Room`** — attendees *(step 5)*

| Route | Who | Purpose |
|---|---|---|
| `GET /rooms` | signed in | meetings I may attend (invited, or I am the presenter) |
| `GET /rooms/{id}` | signed in | detail. **No join link, no invite list.** |
| `POST /rooms/{id}/join` | signed in | token for a member |
| **`GET /join/{joinToken}`** | anonymous | what the landing page needs: name, start time, join mode, whether it is open yet. **No ids, no invite list.** |
| **`POST /join/{joinToken}`** | anonymous | `{ fullName }` for a public meeting → guest token. Private ⇒ 401 with "sign in first" |
| `GET/POST /rooms/{id}/messages` | signed in or valid guest | chat |
| `POST /webhook` | anonymous + LiveKit JWT verify | always 200 |

**Join checks, in order** — each with its own Persian message: room exists → not deleted → active →
join mode allows this caller → start time reached (minus grace) → capacity → mint token.

## 7. Front end — `room-web`

New Vite SPA, seventh in the family, dev port **5277**. Same shape as `election-web`.

- `/` — my meetings. Cards: name, presenter, start time, live count, «ورود».
- `/admin` — Administrator. Table with type, join mode, start time, **the join link with a copy
  button on the row**, edit / delete / regenerate link / end.
- `/admin/new`, `/admin/:id` — create and edit, with the presenter picker and the type/join-mode rules
  applied live.
- `/j/{joinToken}` — **the link landing page.** Shows the meeting name and who is presenting, then
  either a name box (public) or a sign-in button (private). Before the start time it shows a
  **countdown**; when the countdown ends the join button enables itself without a reload.
- `/room/{id}` — the meeting. LiveKit primitives; in `Presentation` the audience sees no publish
  controls at all.

The countdown gets proper design attention — it is the first thing an outside guest ever sees of the
organisation, and it is on screen for minutes rather than seconds.

## 8. What is deliberately not in v1

Recording, whiteboard, PDF co-viewing, reactions and raise-hand. All exist in the vahedgas source and
can be ported later; none is needed to hold a meeting.

## 9. Build order

| # | Step | Done when |
|---|---|---|
| 1 | LiveKit on the home VPS + DNS + firewall | `wss://lk.myceo.ir` accepts a hand-minted token |
| 2 | Entities + migration + the type/join-mode rules | invalid combinations are refused |
| 3 | Token + admin client, `IsConfigured`-gated | presenter and audience grants differ, proven |
| 4 | Admin CRUD, link generation, invites | a meeting can be created and its link copied |
| 5 | Join: member, guest, and the anonymous landing endpoint | each gate refuses for the right reason |
| 6 | `room-web`: my meetings + admin table + create/edit | a meeting can be created end to end |
| 7 | The link landing page + countdown | a guest opens a link and waits, then joins |
| 8 | The meeting screen, both modes | audience cannot publish, presenter can |
| 9 | Saved chat | a message survives a reload |
| 10 | Deploy: compose, OIDC client, CORS, DNS, AppSwitcher ×7 | `https://room.myceo.ir` serves it |
