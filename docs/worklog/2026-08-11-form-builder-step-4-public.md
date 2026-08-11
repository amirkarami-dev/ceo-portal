# Form builder step 4: the public form

**Date:** 2026-08-11
**Area:** kurdnezam-web
**Status:** live — proven end to end on kurdnezam.ir

Design: [`docs/design/2026-08-07-kurdnezam-form-builder.md`](../design/2026-08-07-kurdnezam-form-builder.md)

## Goal

Draw whatever fields an administrator defined, send them with their files, and show the form's own
thank-you message. The same thing, on the form page and at the bottom of a news article.

## What changed

**`FormRunner`** (new). One component, used twice — the form page frames it with a picture and a
deadline, the article shows it with its title after the text. Nothing about a form's shape lives in
this app any more.

- text field → input with the field's own `maxLength`
- file field → file input, `multiple` only when the form says so, with the chosen files listed
  underneath, each with its size and a remove button
- `*` and the `required` attribute on required fields; the form carries `noValidate`, so the
  browser's own bubbles never fight the Persian messages
- checks the same rules the server does — required, length, size, type, count — so the common
  mistakes never cost a round trip
- errors land under the field they belong to, because the server keys them `field_{id}`
- on success the whole form is replaced by the administrator's `successMessage`, falling back to
  wording of our own when they left it empty

**`submitForm`** now posts multipart: an `answers` JSON part plus `field_{id}` file parts. No
`Content-Type` header is set — the browser has to add the multipart boundary itself.

**The form page** lost 250 lines of hard-coded inputs. **The news article** renders the form after
the body when the editor attached one.

## Verified on kurdnezam.ir

A form with three fields (two text, one multi-file), attached to article 1:

- both pages render all three fields in order, with `maxLength` 200 and 10, the `accept` list, and
  the help line «۱۰ رقم»
- pressing send while empty marks exactly the two required fields and sends nothing
- a real submit with a PDF → the form is replaced by **«درخواست شما ثبت شد. نتیجه پیامک می‌شود.»**,
  the administrator's own wording
- the row landed with both answers and the file — and the Persian file name **«مدرک.pdf»** survived
  intact
- on the article the form sits *after* the body, with its own title
- mobile 375px: one column, inputs at 16px so iOS does not zoom, controls 48–58px tall, nothing
  wider than the screen

Test form, its submissions and its two storage objects were removed afterwards; the bucket is back
to the 29 objects it had.

## Two things found by testing

**A request that never settles left the send button stuck for ever.** Running the site locally
against the live API, the POST hung — no error, no success, button disabled on «در حال ارسال…»
indefinitely. `submitForm` now carries `AbortSignal.timeout(120s)`: long enough for 15 MB on a
phone, short of forever. A visitor gets a message instead of a dead button.

**The local hang was CORS, and it taught something.** `localhost:3100` is not an allowed origin on
the production API — correctly. But the POST still *reached the server*: submission 204 exists from
that attempt. Only the **response** was blocked, so the browser never told the client. Worth
remembering: a blocked or dropped response does not mean the write did not happen.

## A limit worth naming

Following from the above — if the network drops after the server accepts a submission, the visitor
sees a failure and may send again, creating a duplicate. Nothing here prevents that; it would need
an idempotency key on the request. Not built, because nobody has hit it, but it is a real hole and
should not be discovered by surprise.

## Left to do

- **Step 5 — the design and phone pass** over both surfaces, with `impeccable`.
- The panel screens still have not been clicked through (from step 3). This step proves the shape
  the panel produces is rendered correctly, but not that the builder writes it comfortably.
