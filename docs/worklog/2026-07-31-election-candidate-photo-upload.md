# Election step 10: candidate photos go to file storage

- **Date:** 2026-07-31
- **Area:** election (API + `election-web`)
- **Branch / commits:** `election-steps-6-to-9`
- **Status:** built and tested; **not deployed**

## Goal
"start step 10" — after Amir set the standing rule: *anywhere a user uploads, use the S3 service, in
that service's own folder.* The candidate photo field was the one place in the election service that
broke it.

## What was wrong
The admin form asked for a **typed path** (`/api/kurdnezam/media/...`). Two problems:

1. **No upload.** The admin had to get the file into storage by some other route first, then copy the
   address in. In practice the field stays empty and every voting card falls back to initials.
2. **The wrong folder.** It pointed at the CMS's bucket prefix. Elections borrowing another service's
   folder is exactly what the rule forbids.

I chose that on purpose in step 6 to avoid coupling elections to the CMS. Avoiding the coupling was
right; asking a human to paste a storage path was not.

## What changed
- `src/Web/Endpoints/Elections/ElectionMedia.cs` — **new.** `POST /api/ElectionMedia` (Administrator
  only) stores under the `elections/` prefix via `IFileStorage`; `GET /api/ElectionMedia/{fileName}`
  streams it back. Modelled on `KurdnezamMedia` with the limits narrowed to what this is: **images
  only** (png/jpg/webp) and **2 MB**, against the CMS's document types and 20 MB.
- `election-web/src/components/ui/PhotoField.tsx` — **new.** A real picker: circular preview at the
  size the ballot uses, upload / change / remove, inline size check, server errors shown verbatim.
- `election-web/src/lib/api.ts` — `uploadImage()` (multipart, bearer token attached), plus `toError`
  now understands a bare JSON string body — `TypedResults.BadRequest("...")` serialises that way and
  the upload endpoint's Persian messages were being thrown away as "unexpected error (400)".
- `election-web/src/features/elections/ElectionForm.tsx` — the text box is now `PhotoField`, fed the
  candidate's typed name so the preview shows the same initial a voter would see.
- `tests/Application.FunctionalTests/Elections/ElectionMediaTests.cs` — **new, 6 tests.**

## Decisions
- **`GET` is anonymous, deliberately.** A browser does not send an `Authorization` header for
  `<img src>`, so an authenticated route would show broken images on every ballot. Presigned URLs
  expire mid-election. Nothing is exposed: a candidate photo is published to every voter by design, and
  the object name is 32 random hex characters. Written out in the endpoint's remarks so the next reader
  does not "fix" it.
- **Its own prefix, not the CMS's.** `elections/`. The file-name regex is the guard that keeps the
  anonymous GET inside it — without it, `../reports/x.pdf` would stream somebody's assessment report
  out of the same bucket. That case has a test.
- **Images only.** The CMS pattern accepts pdf/doc/xls because it stores بخشنامه. This stores a face.
- **Removing a photo clears the reference only**, it does not delete the object. A published election is
  frozen, and deleting a file a live ballot still points at would break the card for every voter.
- **The value stays the stored path**, the same string the form already submitted, so nothing
  downstream — DTO, validator, voter card, Bale bot — needed changing.

## Verification
- `dotnet test tests/Application.UnitTests` — **250 passed, 0 failed**.
- `dotnet test tests/Application.FunctionalTests` — **72 passed** (+6 new), 3 failed: the same
  pre-existing failures recorded in `2026-07-30-election-voter-flow.md`.
- The 6 new tests pin the things that would be silent if wrong: the prefix is `elections/` and not
  `kurdnezam/`; the cap is 2 MB; only image names are servable; `../reports/secret.pdf`,
  `reports/x.jpg` and `/etc/passwd` are all rejected; a name that is not 32 hex characters is rejected.
- `election-web`: `npm run typecheck`, `npm run lint`, `npm run build` — all clean.

**Not verified:** no photo has actually been uploaded. That needs a signed-in administrator and a live
MinIO, so it happens on the deployed site.

## Follow-ups
- **Deploy** `api` and `election-web` (nothing else changed), then upload one photo and check it appears
  on the voting card.
- Orphaned objects are never collected: replacing a photo leaves the old one in the bucket. Harmless at
  this volume (a few dozen portraits a year) and deliberately not solved — a cleanup job that deletes
  storage objects near a live election is more dangerous than the wasted bytes.
- The same rule still needs applying elsewhere if any other service grows an upload.
