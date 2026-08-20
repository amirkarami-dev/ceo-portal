# Meeting files, and the whiteboard in Persian

- **Date:** 2026-08-20
- **Area:** room / api
- **Branch / commits:** `feat/room-persian-and-files` — `7e8eb76`, `48bf084`, `b6b3663`, `2bec7fc`, `59d3e3d`, `de929ce`
- **Status:** shipped to production — `api` and `room-web` deployed and proven end to end; **not merged to `main`**

## Goal

The user's words: *"on room service hide library (if need any library i say to install it), hide the
Excalidraw likns on menu, change the Help completely to persian language, change all suggest text
guide under the top menu ... to persian language. also i want full implementation for add the files
to room use s3 that before implement as file management for each room and keep it for access by
button from `<Sme />` tag on list rooms"*

Two things in one branch: the whiteboard should speak Persian and stop advertising Excalidraw, and a
meeting should carry files.

## What changed

**The whiteboard**

- `room-web/vite.config.ts` — an `excalidrawPersian()` build plugin. See the root cause below. It
  patches BOTH paths (Rollup `transform` for `vite build`, esbuild `optimizeDeps` for `vite dev`) and
  **fails the build** if it cannot find the number it is looking for, so a future Excalidraw upgrade
  breaks the build instead of silently shipping English.
- `room-web/src/features/whiteboard/whiteboardMenu.tsx` — our own menu. No GitHub/X/Discord
  (`Socials`), no theme toggle (it could disagree with the app's own theme).
- `room-web/src/features/whiteboard/whiteboard.css` — hides the Library trigger. It is not a prop.
- `room-web/src/features/whiteboard/WhiteboardStage.tsx` — imports the css, mounts the menu.

**The meeting's files**

- `src/Domain/Rooms/RoomFile.cs` + migration `20260820112847_AddRoomFiles` — one row per file. No
  uploader column: `BaseAuditableEntity.CreatedBy` already records it.
- `src/Application/Rooms/RoomFiles.cs` — DTOs, `RoomFileRules`, four handlers.
- `src/Web/Endpoints/Rooms/Room.cs` — four routes on the EXISTING meeting group.
- `src/Application/Rooms/RoomAttendeeQueries.cs` — `MyRoomDto` gains `FileCount` and
  `CanManageFiles`, both filled by one grouped query for the whole page.
- `room-web/src/features/files/RoomFilesPanel.tsx` — the drawer.
- `room-web/src/features/meetings/MyMeetings.tsx` — the button on the card.
- `room-web/src/lib/api.ts` — `apiUpload` and `apiDownload`.
- `tests/Application.UnitTests/Rooms/RoomFileRuleTests.cs` — 12 tests on the storage key.

## Root cause (the whiteboard was never a translation problem)

The board showed English while `langCode="fa-IR"` was set. The obvious readings — a missing locale, a
missing translation, a chunk that never loads — were all wrong. **The Persian locale ships, the
strings are translated, and the file is served.**

Excalidraw refuses to *offer* a language that is less than `COMPLETION_THRESHOLD = 85` percent
translated, and it ships `percentages["fa-IR"] = 84`. One point short. Persian is therefore filtered
out of the `languages` list, `langCode` finds nothing, and it **falls back to English without a
warning of any kind** — and never fetches the locale at all. So the symptom ("no Persian") pointed at
translation files, and the cause was a threshold comparison.

Hand-translating the UI would have been the natural next move and would have been a large, permanent
mistake: the package already contains the translation.

## Decisions

- **Patch the number at build time, and fail loudly.** Nothing else works: the percentage is baked
  into the shipped bundle and there is no prop or option for it. The guard matters more than the
  patch — without it, the next Excalidraw upgrade would move the number and silently ship English
  again, which is exactly how this started.
- **Files live at `/api/Room/{id}/files`, not a new `/api/RoomFiles` group.** The design doc proposed
  the second group; reading the code changed the answer. A meeting's board and chat are already
  sub-resources of `/api/Room/{id}`, anonymous, carrying the guest credential in `X-Room-Token`. A
  second group would have duplicated all three decisions and given them somewhere to drift apart.
- **No new access rule.** Reading uses `RoomChatAccess.ResolveAsync` (the chat and board gate);
  writing uses `Room.MayPublish` (the microphone and pen gate). Three features on one predicate
  cannot disagree. `CanManageFiles` on the DTO is that predicate, and it is NOT `IsPresenter` — in a
  جلسه everyone may add a handout and nobody is the presenter.
- **The caller's filename never becomes the storage key.** It is browser text that would otherwise
  choose a path. The key is `rooms/{roomId}/{guid}{ext}` with the extension itself bounded; the real
  name lives in the row. Verified in production: the object is
  `mabhas19/rooms/1/f051f7d0….txt` and «آزمایش-استقرار» appears nowhere in it.
- **The list carries no uploader name.** The row records `CreatedBy`, but for an engineer that
  identity IS their کد ملی, and this list is read by the whole audience of a presentation.
- **Delete removes the object before the row, and tolerates storage failing.** An object already gone
  must not leave a row nobody can remove. Tidiness in a bucket is worth less than not creating a dead
  end on screen.
- **Download goes through the API, not a presigned URL.** A meeting's audience is controlled and a
  link would outlive that control.
- **The card button has three states, not two.** Files → «فایل‌ها (۳)»; no files but may add →
  «افزودن فایل»; no files and may not add → nothing at all. A button that opens an empty panel to
  somebody who cannot fill it is a wasted tap on an already long card.

## Verification

**Local:** `dotnet build src/Web` clean; **528 unit tests pass** (12 new); room-web `typecheck`,
`lint --max-warnings 0` and `build` all clean.

**Measured in a browser at 375px**, against the real page with the query cache seeded (signing in
needs a password):

- page `scrollWidth` 375 = viewport, zero elements past the edge, drawer 375 wide
- all three card-button states render as designed
- every icon button measures exactly 44×44
- a 60-character unbroken Persian filename wraps instead of pushing the buttons out
- 0 `<a>` elements point at `/api/`
- a 21MB file is refused with the server's own sentence and **no POST is made**; a small one does
- the rows **survive a failed background refetch** — see the react-query trap in `GOTCHAS.md`

**On production, after deploying `api` then `room-web` one at a time:**

- `GET /api/Room/1/files` moved **404 → 401**; `/api/Room/1/nonsense` still 404, so 404 really does
  mean "no route"
- `GET /api/Room/files/1/content` answers `"Queried object file was not found, Key: 1"` — the guard
  firing *after* a successful query, which proves `dbo.RoomFiles` exists and is queryable
- room-web entry bundle changed `index-Drz7dpdD.js` → `index-DSn73_gu.js`, and **the public site
  serves the new one**
- the deployed bundle contains `"fa-IR":85` and **zero** occurrences of `"fa-IR":84`, plus the
  Persian canvas hint and the library-hiding rule
- the dev probes are absent from the production bundle
- **a full round trip on the meeting «جلسه تست»**: uploaded a 42-byte file with a Persian name →
  object appeared at `mabhas19/rooms/1/f051f7d0….txt` (42 B) → downloaded it back **byte-identical
  with the Persian name intact** → deleted it → **both the row and the MinIO object are gone**.
  Production is back exactly as it was found.

**NOT verified:**

- Nobody has drawn on the Persian whiteboard in a real meeting. The locale, the menu and the hidden
  Library are proven in the shipped bundle and in a dev probe, but board **save and sync** were not
  re-exercised after the menu change — they need two browsers in a live LiveKit room.
- No **guest** (link, no account) has used the files panel. Only a signed-in presenter's path was
  walked. The guest path shares `RoomChatAccess` with chat, which does work, but it was not tried.
- Only a `.txt` was moved. No large or binary file, and no upload over a slow connection.
- The `sa` password in `deploy/.env` does **not** log in to the running SQL Server, so the table was
  proven through the API rather than a direct query. Worth knowing before the next person tries.

## Follow-ups

- **«Find on canvas» is the last English string** in the board menu. Three options: leave it, remove
  the item, or wire our own — the last is fragile, because it needs a sidebar tab name that is not in
  the public types. Undecided; raised with the user twice.
- **An anonymous caller can tell whether a file id exists**: `/api/Room/files/{id}/content` answers
  404 for a missing row and 401 for one that exists but is not theirs. It leaks only "id N exists
  somewhere" — no name, no room, no bytes — and the chat and board routes have the same shape for
  room ids. Inherent to a by-file-id route: the access gate needs the room, which comes from the row.
  Accepted for now; worth revisiting if file ids ever become guessable across tenants.
- **`deploy/.env`'s `MSSQL_SA_PASSWORD` is not the live one.** The database volume predates it. Not
  touched — changing a database password mid-flight is its own task.
- The branch is **not merged**.
