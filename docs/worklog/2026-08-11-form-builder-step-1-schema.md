# Form builder step 1: the tables

**Date:** 2026-08-11
**Area:** kurdnezam (api / database)
**Status:** live on production — nothing uses it yet

Design: [`docs/design/2026-08-07-kurdnezam-form-builder.md`](../design/2026-08-07-kurdnezam-form-builder.md)

## Goal

Tables for forms an administrator builds field by field, and a link from a news article to one form.
Step 1 is schema only. No API, no screens.

## What was already there

A Forms feature existed with **five fields fixed in code** — name, national id, membership no,
mobile, notes. Checked production first: `forms=0  submissions=0`, because the old rows had been
deleted. So there was nothing to move, and the fixed fields can be dropped in step 2 with the API
that replaces them.

## What changed

Purely additive. Nothing was removed or altered, so the migration cannot damage existing data.

```
KurdnezamForms          + SuccessMessage        empty = the site uses its own wording
KurdnezamNews           + FormId (nullable)     the form shown on that article

KurdnezamFormFields     Label · Kind · IsRequired · AllowMultiple · MaxLength · Help · SortOrder
KurdnezamFormAnswers    SubmissionId · FieldId · FieldLabel · Text
KurdnezamFormAttachments SubmissionId · FieldId · FieldLabel · FileName · StoredKey · ContentType · SizeBytes
```

`Kind` is a **string with a CHECK constraint** (`'text'`, `'file'`), not a C# enum — this API sends
enums as numbers.

Delete rules, all chosen on purpose:

| Deleting | Effect |
| --- | --- |
| a form | its fields and submissions go with it |
| a submission | its answers and files go with it |
| a form used by an article | the article stays, its `FormId` becomes null |
| **a single field** | **answers stay**, and still read correctly |

That last row is why `FieldId` is a plain int rather than a foreign key, with the label copied onto
each answer. A real key would either delete what people sent or block the delete, and it would give
SQL Server two cascade paths into the answers table, which it refuses.

## Verified

Built a scratch database from **every** migration in order, applied the new one, then:

- three new tables present, `News.FormId` nullable, `Forms.SuccessMessage` not null
- `CK_KurdnezamFormFields_Kind` **refused** `'dropdown'` and accepted `'file'`
- deleting a field left the answer in place, still reading «نام» from its label copy
- deleting a form removed its fields and submissions, and removed the submission's answers and files
- deleting a form left the article alone and set its `FormId` to null
- `Up()` contains no `Drop*` at all — the only drops are in `Down()`

On production after deploying: migration `20260811113536_AddKurdnezamFormBuilder` recorded, the
three tables and two columns exist, the CHECK reads `([Kind]='file' OR [Kind]='text')`, content
untouched at `news=25`, and kurdnezam.ir / api / landing-panel all answer 200.

## Two things worth remembering

**A failing test that was my fault, not the code's.** The first script run died with
`Msg 1934 … 'QUOTED_IDENTIFIER'`. It was not the new migration: three **filtered** indexes from
earlier work need `QUOTED_IDENTIFIER ON`, and `sqlcmd` defaults it OFF while ADO.NET defaults it ON.
`sqlcmd -I` fixed it. The running app was never affected. Recorded in `GOTCHAS.md`.

**A test that proved nothing.** The first behaviour run reported "article kept: 0" for the
form-delete rule. The article had never been created — the scratch database has no categories and
`KurdnezamNews.CategoryId` is NOT NULL, so the insert failed and the check measured an empty table.
Re-run with a category first, and the rule then held.

## Left to do

- **Step 2 — API.** Form CRUD carrying its fields, public submit with files, admin reads submissions
  and downloads a file. Drops the five fixed columns in a second migration.
- Steps 3–5 as in the design doc: the panel builder, the public component, then the design pass.
