# Form builder step 3: the panel

**Date:** 2026-08-11
**Area:** kurdnezam / landing-panel / api
**Status:** deployed — server side proven; the panel screens have not been clicked through

Design: [`docs/design/2026-08-07-kurdnezam-form-builder.md`](../design/2026-08-07-kurdnezam-form-builder.md)

## Goal

An administrator builds a form field by field at `/forms`, and picks one form to show on a news
article.

## What changed

**A gap step 1 left.** `KurdnezamNews.FormId` existed as a column but the API never exposed it, so
the panel had nothing to write to. The News DTO now carries `formId` and `formTitle`, the input
carries `formId`, and both queries project it.

**The field builder** (`FormsPage`). An AntD `Form.List` inside the existing drawer: add a text
field or a file field, rename, mark required, reorder with up/down, delete. Per kind, only the
option that applies is shown — a text field offers a character limit, a file field offers "several
files". A form must have at least one field; the drawer refuses to save an empty one.

Two smaller things there:

- **Position is the order.** `sortOrder` is written from the position in the list on save, so nobody
  has to keep numbers in step by hand.
- **A new form starts with one field** («نام و نام خانوادگی»), so the builder is never a blank box.
- The table gained a fields column, and editing a form that already has submissions shows a note
  saying deleting a field will not delete answers already sent.

**The form picker** (`NewsPage`). An optional select at the bottom of the article editor. Closed
forms and forms with no fields still appear — an editor may be preparing an article ahead of time —
but they are tagged so neither is attached by accident.

**The inbox** (`SubmissionsPage`). The five fixed columns are gone; they no longer exist. A
submission now shows its first two answers inline, a file count, and opens to a full list of answers
plus a download button per file. CSV export flattens answers to `label: value` pairs.

**Downloading a file** needed a real decision. The route is admin-only, so a plain `<a href>` cannot
work — a browser will not put a Bearer token on a normal navigation. `downloadProtectedFile` fetches
the bytes with the token and hands them over as a blob. This is the only way an attachment reaches
anyone, which is the point: a member may have attached a scan of their national id card.

## Verified

- panel typechecks clean and lints clean
- API builds 0 errors
- attached a form to a real article, then read the public API:
  `"formId":5, "formTitle":"فرم پیوست خبر"` on the single-article route, and `formId` present on
  the list route
- the deployed panel bundle contains every new control — «فیلدهای فرم», «افزودن فیلد متن»,
  «افزودن فیلد فایل», «فرم پایان خبر», «پیام پس از ثبت», and the `forms/attachments` download path
- test data removed afterwards: `forms=0`, `news` still 25

## What is NOT verified

**I have not clicked through the panel screens.** The panel sits behind the IdP and I do not type
passwords into a browser. Typecheck, lint and the shipped bundle all agree the code is there, but
nobody has yet opened the drawer, added a field and saved it.

Worth doing before step 4, since step 4 renders whatever this produces:

1. `/forms` → add a form with one text field and one file field → save → reopen and check it read back
2. reorder two fields, save, reopen
3. `/news` → edit an article → pick that form → save → reopen
4. delete a field on a form that has submissions → confirm old answers still show in the inbox

## Small clean-up made on the way

`formatSize` lived privately inside `AttachmentUploader`. Submissions needed the same thing, so it
moved to `lib/format.ts` as `formatBytes` and the uploader now imports it — one implementation
rather than two.

## Left to do

- **Step 4 — the public component**, used by both the news page and `/forms/{id}`.
- **Step 5 — design and phone pass.**
- `/forms/{id}` on the public site is still the old five-field page and will break if anyone opens
  it. No form exists on production, so nobody can.
