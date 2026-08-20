# room-web: a Persian whiteboard, and files for each meeting

- **Date:** 2026-08-20
- **Area:** room / api
- **Status:** design, waiting for «start step 1»

## What was asked

> «hide library (if need any library i say to install it), hide the Excalidraw links on menu, change
> the Help completely to persian language, change all suggest text guide under the top menu (for
> example i see the "To move canvas, hold mouse wheel or spacebar while dragging, or use the hand
> tool") to persian language. also i want full implementation for add the files to room use s3 that
> before implement as file management for each room and keep it for access by button from `<SMe />`
> tag on list rooms»

Two pieces of work: the whiteboard's chrome (small), and per-meeting files on S3 (a feature).

## What I checked first

**The Persian text is already there and is not being used.** `WhiteboardStage.tsx:148` already sets
`langCode="fa-IR"`. The shipped locale really does translate the exact sentence quoted above:

```
canvasPanning: "برای حرکت دادن بوم، چرخ ماوس یا فاصله را در حین کشیدن نگه دارید یا از ابزار دستی استفاده کنید"
```

And the live site serves that locale chunk — `/assets/fa-IR-…js`, **200, 24,281 bytes**, with nothing
pointing at `unpkg.com`. So the words exist, the browser can fetch them, and English still shows.

**This is the whole reason step 1 is a question, not a task.** The obvious reading — "Persian is
missing, so write the Persian" — is wrong, and acting on it would mean hand-maintaining forty strings
that the package already ships. Find why the locale is not applied; the fix is likely one line.

**Excalidraw 0.18 gives exact hooks for the rest** (read from its own `types.d.ts`, not the docs):

| Want | Prop |
|---|---|
| Hide the Library button | `renderTopRightUI={() => null}` — the Library trigger lives in that area |
| Choose the menu items | pass our own `<MainMenu>` as a child; the default menu (with GitHub / X / Discord) is then not rendered at all |
| Turn tools/actions off | `UIOptions.canvasActions`, `UIOptions.tools` |

**The file feature has an existing pattern to copy.** `IFileStorage` (put / get / delete / presigned
URL) is already MinIO-backed, and Kurdnezam form attachments are a working example of files attached
to a record — including a download that **streams the bytes through the API** rather than handing out
a URL, because the route is protected and a browser will not put a Bearer token on a plain link.

**The card is `MeetingCard`** in `room-web/src/features/meetings/MyMeetings.tsx:28` — the `<SMe />`
in the request.

## Decisions

Answered by the user before any code:

- **The presenter uploads; everyone who may enter the meeting may download.** Same shape as the
  whiteboard: the presenter drives, the audience receives.
- **Files stay until somebody deletes them.** The meeting ending does not remove them, so the button
  on the card keeps working afterwards.

Assumed unless corrected:

- **One folder per room in MinIO**, `rooms/{roomId}/{guid}{ext}`, following this estate's rule that
  every upload lands in that service's own folder. The stored key is never the user's file name.
- **20 MB per file, 10 files per meeting.** A number is needed and these are ordinary handout sizes;
  say the word and they change.
- **No file type restriction**, because a meeting handout can be anything. The download always sets
  `Content-Disposition: attachment`, so nothing is rendered in the browser.
- **The button shows on every card**, with the count on it, and opens a panel that is read-only for
  an audience member. Hiding it for non-presenters would leave the audience unable to reach handouts,
  which is the point of keeping them.

## Part A — the whiteboard chrome

### Step 1: make the Persian locale actually apply

Find out why `langCode="fa-IR"` does not reach the UI, and fix that cause. Start with a dev harness
that renders `<Excalidraw langCode="fa-IR" />` alone — the whiteboard itself sits inside a meeting
behind LiveKit and a login, which is a poor place to debug a language.

**Verify:** in a browser, the canvas hint reads «برای حرکت دادن بوم…» and the menu items are Persian.
Read it from the DOM, not from a screenshot.

**If the cause turns out to be Excalidraw itself** (a locale it fetches but ignores), say so and stop
rather than hand-writing the strings — that is a different, much larger task and worth a decision.

### Step 2: hide the Library and the Excalidraw links, and put Help in Persian

- `renderTopRightUI={() => null}` on `<Excalidraw>`.
- Our own `<MainMenu>` with only the items this product wants: open, save, export image, find, help,
  reset, and the background picker. No GitHub, no X, no Discord.
- Help under a Persian label.

**Verify:** read the DOM — no `sidebar-trigger` / "Library", no `GitHub`/`Discord chat`, and the help
item's text is Persian. Also confirm the whiteboard still draws and still syncs, since this touches
the component that hosts it.

## Part B — files for each meeting

### Step 3: the table

`RoomFile`: `Id`, `RoomId`, `FileName` (as uploaded), `StoredKey` (ours), `ContentType`, `SizeBytes`,
`UploadedByUserId`, `Created`. Cascade from `Room` so deleting a meeting removes its rows; the objects
themselves are deleted explicitly by the handler, since a database cascade cannot reach MinIO.

**Verify:** migration applies locally; the table exists with an index on `RoomId`.

### Step 4: the API

```
POST   /api/RoomFiles/{roomId}          upload (presenter only)
GET    /api/RoomFiles/{roomId}          list (anyone who may enter the room)
GET    /api/RoomFiles/{id}/content      download (same rule as list)
DELETE /api/RoomFiles/{id}              delete (presenter only)
```

Authorisation is the part to get right, and it is **not** a role check: it is "may this person enter
this room". That question is already answered somewhere in `Application/Rooms` — find it and call it,
do not re-derive it. Handler names carry the `RoomFiles` prefix, because two handlers sharing a method
name make the whole API return 500 (`GOTCHAS.md`).

**Verify:** unit tests for the rules (presenter may upload, participant may not, a stranger may not
list), plus the routes answering 401 rather than 404 on the live API.

### Step 5: the panel and the button

A button on `MeetingCard` showing the file count, opening a drawer: the list, sizes, a download per
row, and — for the presenter — upload and delete.

**Verify:** at 375px, no sideways scroll; the button reads correctly with zero files; download works
through the token, not a plain link.

### Step 6: check, deploy, write the record

Build, lint, phone check, deploy `api` then `room-web` one at a time, then
`docs/worklog/2026-08-20-room-files.md` and the index row.

## Things that will bite you

- **Do not hand-translate what the package already ships.** See step 1.
- **A protected file cannot be an `<a href>`.** The browser will not attach the token. Fetch the bytes
  and hand them over as a blob, exactly as `downloadProtectedFile` does in landing-panel.
- **`Roles.AdminOrSuper`, never `Administrator` alone.**
- **A new `DbSet` must be added to `IApplicationDbContext` too**, or the build returns twenty errors
  that all point somewhere else.
- **Build `src/Web` after the model change**, or `dotnet ef migrations add` writes an empty migration
  and says nothing.
- **The whiteboard is the same component being edited in part A.** Do not let a menu change break the
  board's save or sync; both are covered by existing behaviour worth re-checking.
