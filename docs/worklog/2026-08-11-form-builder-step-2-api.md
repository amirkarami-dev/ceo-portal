# Form builder step 2: the API

**Date:** 2026-08-11
**Area:** kurdnezam (api)
**Status:** live on production, proven end to end — no screens yet

Design: [`docs/design/2026-08-07-kurdnezam-form-builder.md`](../design/2026-08-07-kurdnezam-form-builder.md)

## Goal

Serve a form together with its fields, let anyone send one with files attached, and let an
administrator read the inbox and download a file. Also drop the five columns step 1 left behind.

## What changed

**Reads.** `GET /api/kurdnezam/forms` and `/{id}` now carry `fields` and `successMessage`. One shared
projection, so the list, the single form and the news page can never disagree.

**Writing a form.** `KurdnezamFormInput` carries its fields. Update matches them **by id** rather
than replacing the set, because answers record the field id they were sent against and stable ids
keep old submissions grouped correctly.

**Sending a form.** `POST /{id}/submissions` is multipart:

- a text part `answers` — `[{"fieldId":1,"text":"…"}]`
- file parts named `field_{fieldId}`, repeated for several files

Answers and files arrive together, so nothing reaches storage until the whole thing passes. There
are no orphan objects and the upload path cannot be driven on its own. If the database save then
fails, the objects just written are removed again.

**Reading the inbox.** Submissions come back with their answers and attachments. Attachments carry
no URL — only an id for the admin-only download route.

**Removing things.** Deleting a form or a submission now also deletes its objects from storage. The
rows always cascaded; the files did not, and would have stayed for ever.

## Limits on the public route

It is the one place on this API anyone can write to, so every limit is enforced server-side and
each has a test:

| Limit | Value |
| --- | --- |
| size per file | 5 MB |
| files per field | 3 |
| whole submission | 15 MB, refused by Kestrel before buffering |
| types | pdf, jpg, png, docx |
| rate | 10 per 10 minutes per IP |

The administrator upload route (`KurdnezamMedia`) stays at 20 MB and more types. This one is
deliberately tighter.

## Attachments are not public

`GET /attachments/{id}` requires the Administrator role, sends `Cache-Control: no-store`, and names
the file with `filename*` so Persian names survive. There is no anonymous route that turns a stored
key into a link. A member may attach a scan of their national id card.

## Verified

**418/418 unit tests pass**, 20 of them new and all about the public submit rules — required
fields, text length, one-file-vs-many, the per-field cap, empty and oversized files, allowed and
refused types, a file sent to a text field, and a field the form does not have.

Then against the live API, with a form built in the database:

- `GET /forms/4` returned both fields with `kind`, `isRequired`, `allowMultiple`, `maxLength`
- multipart submit with an answer and a PDF → **201**; the answer and the file landed, the object
  under `kurdnezam/form-uploads/`
- `GET /attachments/1` with no token → **401**; `GET /submissions` with no token → **401**
- an empty submission → **400** with per-field Persian messages
- an `.html` upload → **400**, "نوع فایل «bad.html» مجاز نیست …"
- twelve rapid submits → `201 ×7` then `429 ×5`

## Two mistakes I made, both mine rather than the code's

**A test that was wrong about arithmetic.** `Several_files_…_too_much_together` failed because
3 files × 5 MB is *exactly* the 15 MB submission cap, not over it. The per-submission limit only
bites across **two or more** file fields. The test now uses two fields, and a second test pins the
boundary so a future change to either number is noticed.

**I left eight files in storage.** My cleanup deleted the test rows with raw SQL, which skips the
delete handler that removes objects. Found them with `mc`, removed them, and checked the other 29
objects in the bucket were untouched. Exactly the failure the new delete handlers exist to prevent.

## Left to do

- **Step 3 — panel.** The field builder at `/forms`, and the form picker in the news editor.
- **Step 4 — public component**, used by the news page and `/forms/{id}`.
- **Step 5 — design and phone pass.**
- The public site still posts the old five-field body, so `/forms/{id}` is broken until step 4. No
  form exists on production right now, so nobody can reach it.
