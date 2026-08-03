# Kurdnezam step 2 — the API for contact sections and managed ارکان

- **Date:** 2026-08-03
- **Area:** `src/Application/Kurdnezam`, `src/Web/Endpoints/Kurdnezam`
- **Design:** [2026-08-03-kurdnezam-contact-and-organs-design.md](../superpowers/specs/2026-08-03-kurdnezam-contact-and-organs-design.md) — step 2 of 7
- **Status:** **done and deployed.** The step-1 migrations applied with this deploy.

## What was built

A new application slice `Kurdnezam/ContactSections`, modelled line-for-line on the existing
`TabGroups` slice — DTO with children nested, one mapping function, queries that order children in
memory (`Include` carries no `ORDER BY`), commands with FluentValidation.

| Route | Auth |
|---|---|
| `GET /api/kurdnezam/contact-sections[?includeInactive=]` | anonymous |
| `GET /api/kurdnezam/contact-sections/{id}` | anonymous |
| `POST /api/kurdnezam/contact-sections` | Administrator |
| `PUT`/`DELETE` `/api/kurdnezam/contact-sections/{id}` | Administrator |
| `POST /api/kurdnezam/contact-sections/{id}/channels` | Administrator |
| `PUT`/`DELETE` `/api/kurdnezam/contact-sections/channels/{channelId}` | Administrator |

`includeInactive` **defaults to false**, so forgetting it under-shares rather than leaking a retired
section to the public site.

**Extended, not replaced:** every new field on `KurdnezamOrgPageInput`,
`KurdnezamSettingsInput` and `KurdnezamContactMessageInput` is optional with a default. An older
cached copy of the site posting the previous payload keeps working.

## Rules worth naming

- **`Kind` is validated twice** — a FluentValidation rule so the admin gets a readable message, and
  the database CHECK constraint so anything arriving another way still bounces.
- **`sectionId` on the public form is checked against *active* sections.** That endpoint is
  anonymous, so the id is attacker-controlled; without the check anyone could pin messages to a
  retired block, or to any integer at all.
- **A page cannot be its own parent**, its parent must exist, and the parent must itself be
  top-level. The site draws one level of cards and one level of dropdown, so a grandchild would
  never appear anywhere.
- **A hub with children cannot be demoted.** Moving `arkan` under something else would orphan five
  pages — reachable only by typing the URL.
- **Org pages now sort by `ParentSlug` first** (SQL Server puts NULL first, so top-level leads).
  Without that, a child with SortOrder 1 interleaves with a top-level page with SortOrder 1.
- **`MapLabel` falls back to `Address` in the query**, not in the site, so every consumer gets the
  same non-empty string without repeating the rule.

## One build error worth remembering

Adding the two `DbSet`s to `ApplicationDbContext` was not enough — the Application layer talks to
**`IApplicationDbContext`**, and twenty-odd `CS1061`s came back, several of them misleading
(`'CancellationToken' does not contain a definition for 'Id'` is what a failed `FirstOrDefaultAsync`
overload resolution looks like). Add the set to **both**. Noted in GOTCHAS, because a build here is
a round-trip to the server.

## Deployed and verified live

```
migrations applied  20260803041535_AddKurdnezamContactSections
                    20260803042855_BackfillKurdnezamContactContent
arkan children 5 | tamas page 1 | sections 1 | channels 5

GET /api/kurdnezam/contact-sections
  دفتر مرکزی [building] پاسخگویی در ساعات اداری
     address  سنندج - میدان کوهنورد - جنب بانک مسکن - …
     phone    08733564876 / 08733564874 / 08733564878
     postal   6619775411

org pages     arkan(-)  tamas(-)  majmaeomumi/modir/hayatraise/shorayeentezami/bazrsin → parent=arkan
settings      mapLabel = سنندج، میدان کوهنورد — جنب بانک مسکن
content       contactSections present, 1 | orgPages with a parent: 5

POST/DELETE without a token           401
sectionId 999999                      400 "The selected section does not exist."
news settings units people tab-groups org-pages quick-links categories forms   all 200
kurdnezam.ir, /p/tamas, /p/arkan, refahi                                        all 200
api / auth / vms / room                                                         unaffected
```

Handler names were checked for global uniqueness before deploying — a collision there 500s the whole
API, and the nine sibling endpoints returning 200 confirms it.

The **success** path of the contact form was deliberately not exercised: it would have put a test
message in the real admin inbox, which I cannot then delete without an admin token.

## Next

Step 3: the admin panel's **بخش‌های تماس** page — master/detail CRUD with an icon picker.
