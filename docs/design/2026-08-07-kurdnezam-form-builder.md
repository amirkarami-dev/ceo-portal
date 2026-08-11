# Design: forms an admin can build, shown on a news page

**Date:** 2026-08-07
**Status:** proposed — not started
**Area:** api / landing-panel / kurdnezam-web

## What you asked for

1. In the panel at `/forms`, an admin can **add fields** to a form. For now: **text box** and
   **file** (one file or many).
2. A news article can **point at one form**.
3. On the news page the form shows as a **component with a save button**.
4. After a good save, show **the message for that form**.

## What is already there

| Piece | Today |
| --- | --- |
| `KurdnezamForm` | Title, Note, Deadline, Image, IsOpen, SortOrder |
| `KurdnezamFormSubmission` | **5 fixed fields** — name, national id, membership no, mobile, notes |
| `/forms/{id}` public page | draws those 5 by hand, sends with no login |
| landing-panel `/forms` | add/edit forms, read submissions |
| upload | `/api/kurdnezam/media` — **admin only**, 20 MB |
| news → form | does not exist |

Checked on production **2026-08-07**: `forms=0  submissions=0  news=25`. You deleted the old rows,
so there is **no data to move**. That is why the plan below can drop the 5 fixed fields instead of
keeping them.

## The model

Every field becomes a row. Nothing is fixed any more.

```
KurdnezamForm            + SuccessMessage      the text shown after a good save
  └── KurdnezamFormField                       one row per field the admin adds
        Label            what the member reads (Persian)
        Kind             "text" | "file"
        IsRequired
        AllowMultiple    only used by "file"
        MaxLength        only used by "text"
        Help             small grey line under the box, optional
        SortOrder

KurdnezamFormSubmission  (FullName / NationalId / MembershipNo / Mobile / Notes are removed)
  ├── KurdnezamFormAnswer      { FieldId, Text }        one per text field
  └── KurdnezamFormAttachment  { FieldId, FileName, StoredKey, ContentType, Bytes }

KurdnezamNews            + FormId (nullable)   the one form to show on that article
```

`Kind` is a **string with a CHECK constraint**, not an enum. The API sends enums as numbers, which
has bitten this repo before (`docs/ai/GOTCHAS.md`).

Deleting a form sets `News.FormId` back to null — it never deletes the article.

## Files: public upload, admin-only download

You chose "anyone can attach, with hard limits". Two parts to that, and the second is mine to
raise:

**Sending.** Files go **with the submission in one request** (multipart), not to a separate upload
box first. This means:

- nothing is ever written to storage until the whole form passes its checks, so the upload path
  cannot be spammed on its own;
- there are **no orphan files**, so no cleanup job is needed;
- the cost is no progress bar — the save button shows a spinner instead. With the caps below that
  is a short wait.

**Reading.** Uploaded files are **not** downloadable by URL. Only an admin can open them from the
submissions screen.

This is not me overriding your choice — it is what "public upload" has to mean here. A member may
attach a scan of their national id card. The current media route serves any file to anyone who
knows the name; using it for form attachments would put personal documents on a public URL.

Hard limits, all enforced on the server:

| Limit | Value | Why |
| --- | --- | --- |
| size per file | 5 MB | the admin route allows 20 MB; the public one should not |
| files per field | 3 | with "many" turned on |
| whole request | 15 MB | caps one submission |
| types | pdf, jpg, jpeg, png, docx | narrow on purpose |
| rate | per IP, per form | stops a flood |

Files live in MinIO under their own prefix, as every upload in this repo does.

## What I am assuming

Say if any of these is wrong — each is easy to change now and annoying later.

1. **One form per article.** Not a list.
2. **The success message is per form**, written by the admin, and is plain text.
3. The form still keeps its own page at `/forms/{id}`. The news page shows the same component.
4. **Text box only** for now, as you said — no dropdown, date or number. `Kind` is a string, so
   adding those later is one row and one input.
5. Submitting stays **open to anyone**, as it is today.

## Steps

Each step ends working and checked.

1. **Schema.** New tables, `SuccessMessage`, `News.FormId`, migration. → verify: migration runs on a
   copy of production data, and the CHECK constraint refuses a bad `Kind`.
2. **API.** Form CRUD carrying its fields, public submit with files, admin reads submissions and
   downloads a file. → verify: unit tests for validation, and a real submit with a file end to end.
3. **Panel.** The field builder at `/forms` — add, reorder, delete, mark required — and the
   form picker in the news editor. → verify: build a form in the browser and see the rows in the DB.
4. **Public component.** One component that draws a form from its fields, used by both the news page
   and `/forms/{id}`. Save, then show the message. → verify: submit from the browser, see the answer
   and the file in the admin screen.
5. **Design and phone pass.** `impeccable` over the component and the builder; per-component mobile
   check as this repo requires. → verify: no sideways scroll, 44px targets, contrast AA.

## What could go wrong

| Risk | Handling |
| --- | --- |
| A public write path to storage | one request only, tight caps, admin-only download |
| An admin deletes a field that has answers | keep the answers, show them as "removed field" rather than losing them |
| Big multipart on a phone | 15 MB cap, spinner, and one clear error if it fails |
| `Kind` grows later | it is a string with a CHECK; adding "date" is a migration of one line |

---

Say **start step 1** when you want the schema.
