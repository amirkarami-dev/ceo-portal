# Room step 9: saved chat

- **Date:** 2026-07-31
- **Area:** room
- **Status:** **criterion met and observed** — a message survived a full reload, in a browser, sent by
  a guest with no account

## Goal

Step 9's success criterion: **a message survives a reload**.

## What changed

- `src/Application/Rooms/RoomChat.cs` — `RoomChatAccess` (who may read/write), the two handlers, and
  `RoomChatRules.Clean`.
- `IRoomTokenService.VerifyJoinToken` + its implementation — the guest's credential.
- `GET/POST /api/Room/{id}/messages`, anonymous at the routing level, credentialled in the handler.
- `room-web/src/features/meeting/ChatPanel.tsx`, plus a tabbed side panel (گفتگو / شرکت‌کنندگان).
- `setRoomToken` in the API client; `X-Room-Token` on every request while a meeting screen is open.
- `tests/…/Rooms/RoomChatTests.cs` — 15 tests, most of them attacks on the credential.

## The problem worth writing down: a guest has no account

Chat is the only way an audience member can say anything at all — in an ارائه they cannot speak — so
it has to work for someone who arrived from a chat link with no login. That rules out a bearer token,
and the obvious alternatives are both bad:

- **Trust the body.** Send `senderId`/`senderName` with the message. Then a link is a way to post as
  anyone, and «مدیر سازمان» becomes typeable.
- **Trust the link.** Accept the room's `JoinToken` as the credential. Better, but it identifies the
  *room*, not the *person* — every holder of one link is indistinguishable, so nothing can be
  attributed and nothing can be revoked per participant.

**What they do have is the media token we signed for them.** It binds one identity to one room, it
carries `exp`, and only we and LiveKit hold the key. That is exactly the credential chat needs, so
rather than invent a second token type, `VerifyJoinToken` checks the signature and the API uses it.

Consequences that fall out of that choice, all of them good:

- The sender's name comes out of **our own signature**, so a guest cannot rename themselves between
  messages — and `IsGuest` is decided by the identity shape the server minted (`guest-…`), never by a
  field in the body. The command has no sender, no display name and no guest flag at all.
- **The room in the token is checked against the room being written to.** A token names exactly one
  meeting; without that check one public link would be a credential for the chat of every meeting on
  the server.
- It expires on its own.

Two smaller decisions:

- **Its own header, `X-Room-Token`, not `Authorization`.** That header belongs to the IdP's tokens,
  and a second differently-issued JWT in it would be validated against the IdP and fail for a reason
  that has nothing to do with why the request was refused.
- **Signature comparison is `CryptographicOperations.FixedTimeEquals`.** A byte-by-byte compare that
  returns early leaks how much of a forged signature was right, and this endpoint can be called as
  fast as the network allows.

## Other decisions

- **A member must pass the same gates as the door.** «Not invited» keeping somebody out of the room
  while letting them read everything said in it would make the invite list decorative — so an
  uninvited member gets the same 404 as a stranger, not a 403 that confirms the meeting exists.
- **Saved by the API, delivered live over the data channel.** The POST returns the saved row and the
  sender broadcasts *that row* to everyone else. Polling would cost every participant a request every
  few seconds against a rate limit they share with everyone behind their NAT — precisely the case a
  public webinar creates. Data-channel-only would not survive a reload, which is the whole step.
- **De-duplication is by database id**, because a line legitimately arrives twice for the sender: once
  from their own POST, once from the broadcast. Ids come from the database, so they cannot collide.
- **Anything on the data channel that is not our own JSON is ignored.** The channel is shared and any
  participant can put what they like on it; that parse is the boundary.
- **A closed meeting takes no new messages but stays readable.** Closing the doors is not deleting the
  record.
- **Line breaks survive, bidi overrides do not.** A chat message may have paragraphs, unlike a display
  name — but U+202E would let one message reverse the rendering of the whole transcript for everybody,
  and cleaning at render time is too late because this text also goes out over the data channel to
  clients we did not write. The Persian نیم‌فاصله (U+200C) is spared, same as in a name.

## Verification

**The criterion, in a browser.** A guest opened the public link, joined as «رضا احمدی», and sent
«سلام، صدا خوب می‌رسه؟». Then the page was **fully reloaded** and re-joined as a different guest,
«مریم کاظمی» — a new session with a new identity. The panel showed:

> **رضا احمدی** `مهمان` ۲۲:۴۰ — سلام، صدا خوب می‌رسه؟

Not «شما»: the history is attributed to the identity that wrote it, and the new reader is correctly a
different person. A second line was sent and both appeared with the right attribution. The database
agrees:

```
Id  SenderName    IsGuest  Text                    SenderId
1   رضا احمدی      1        سلام، صدا خوب می‌رسه؟    guest-791c0d0507c12d9e
2   مریم کاظمی     1        بله، کاملاً واضحه        guest-3f07092a4490eb1a
```

Two distinct server-minted identities, `IsGuest` set by the server on both, and the نیم‌فاصله in
«می‌رسه» intact.

**The credential, under attack** — 15 functional tests, and these are the ones that matter:

| Attack | Result |
|---|---|
| No credential at all | 401 |
| A **valid** token for a *different* meeting | 404, nothing written |
| A tampered payload (signature no longer matches) | 401, nothing written |
| An expired token, genuinely signed | 401, nothing written |
| Rubbish in the header (`a.b`, `...`, `%%%.%%%.%%%`) | 401, no unhandled exception |
| A guest trying to change their name between messages | impossible — no field to change |
| An uninvited member reading a private meeting's chat | 404 |
| A bidi override in the message | stripped |
| A deleted meeting's transcript | 404 |

Plus: solution builds; unit **326 passed**; functional **145 passed / 3 failed** — the same three
pre-existing failures from `2026-07-30-election-voter-flow.md`.

## Follow-ups

- **Live delivery between two participants has not been watched**, only the send-and-persist path and
  the reload. One browser cannot easily be two participants; the data-channel receive path is
  therefore exercised only by the sender's own broadcast. Worth one look with two windows.
- Step 10: deploy. `appsettings.Development.json` still points `LiveKit:*` at `localhost:7880` —
  **that must not reach production**.
- The rate limiter from step 7 is still worth settling before a public webinar. Chat makes it slightly
  more pressing: each sent line is one more request against the shared per-IP budget.
