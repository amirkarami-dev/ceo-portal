# Kurdnezam step 1 — schema for managed contact sections and managed ارکان

- **Date:** 2026-08-03
- **Area:** `src/Domain/Kurdnezam`, `src/Infrastructure/Data`
- **Design:** [2026-08-03-kurdnezam-contact-and-organs-design.md](../superpowers/specs/2026-08-03-kurdnezam-contact-and-organs-design.md) — step 1 of 7
- **Status:** **done, verified against production data. Not yet applied** — it runs at the next API deploy.

## What was built

**Two new entities**, following the `KurdnezamTabGroup` / `KurdnezamTabItem` pair already in the repo
rather than inventing a shape:

- `KurdnezamContactSection` — Title, Description?, Icon?, SortOrder, IsActive
- `KurdnezamContactChannel` — SectionId (cascade), Kind, Label?, Value, SortOrder

`Kind` is a **string with a CHECK constraint**, not a C# enum: this API serialises enums as numbers,
so an enum would put `3` in the admin dropdown and in the JSON.

**Three changed entities:**

| Entity | Added | Why |
|---|---|---|
| `KurdnezamOrgPage` | `ParentSlug`, `Icon`, `Summary` | an ارکان card *is* an org page — one row drives the card, the nav entry and the page |
| `KurdnezamContactMessage` | `SectionId` → section, **SET NULL** | a message must outlive the block it was sent to |
| `KurdnezamSettings` | `MapLabel`, `MapUrl` | the map caption was a string literal |

## Two migrations, not one

The backfill started inside the schema migration and failed:

```
Msg 207 ... Invalid column name 'ParentSlug'.
```

SQL Server compiles an entire batch before executing any of it, so an `UPDATE` naming a column that
an earlier statement **in the same batch** adds cannot resolve. `EXEC sp_executesql` would work but
would bury four hundred characters of Persian in doubled quotes. A second migration is a second
batch, and reads far better:

- `20260803041535_AddKurdnezamContactSections` — schema only
- `20260803042855_BackfillKurdnezamContactContent` — data only

The second one's `Up()` was **empty when generated**, because the model had not changed. That is
correct here and is *not* the stale-startup-bin trap in GOTCHAS; the file says so, so nobody
"fixes" it later.

## The backfill

Guarded on `KurdnezamOrgPages` being non-empty, and that guard is load-bearing:

- **empty database** → migrations run, then the seeder. The guard makes the backfill a no-op and the
  seeder does everything. Without it, both would insert `tamas` and the second would hit the unique
  index on `Slug`.
- **existing database** → the backfill does everything and the seeder is already a no-op.

Every statement is independently idempotent as well.

The head-office block is **read out of the live settings row** — `Address`, `PhonesJson` via
`OPENJSON`, `PostalCode` — instead of values written into the migration, so it cannot ship a phone
number that has since changed. `OPENJSON` needs compatibility level ≥ 130; this database is **160**
(SQL Server 2022, 16.0.4255.1), checked before relying on it.

## Verified against production, without touching it

The whole thing was applied to the live database inside `BEGIN TRANSACTION … ROLLBACK`. SQL Server
makes DDL transactional, so this exercises the real `CREATE TABLE` / `ADD COLUMN` and the real
backfill against the real rows, then leaves nothing behind.

```
--- arkan children: these ARE the cards and the nav dropdown ---
  1  majmaeomumi      [vote]         عالی‌ترین رکن سازمان، متشکل از کلیه اعضای دارای پروانه اشتغال.
  2  modir            [users-round]  اداره امور سازمان و اجرای مصوبات مجمع عمومی.
  3  hayatraise       [landmark]     مدیریت اجرایی و راهبری روزانه سازمان.
  4  shorayeentezami  [gavel]        مرجع رسیدگی به تخلفات حرفه‌ای اعضای سازمان.
  5  bazrsin          [scroll-text]  نظارت بر عملکرد مالی و اجرایی سازمان.
--- channels, read out of the LIVE settings row ---
    1  address  سنندج - میدان کوهنورد - جنب بانک مسکن - …
    2  phone    08733564876
    3  phone    08733564874
    4  phone    08733564878
  100  postal   6619775411
--- CHECK constraint on Kind ---     bad kind rejected, as intended
--- retiring a section ---           message survived, SectionId → NULL, channels 5 → 0
--- after rollback ---               ParentSlug col 0, org pages 6, last migration still AddVmsCameras
```

Both migrations compile with **0 errors**.

## One behaviour change worth flagging

The ارکان **nav dropdown order changes**. Cards and the dropdown now read the same rows, so they
must agree. I kept the *cards* exactly as they look today — مجمع عمومی، هیئت مدیره، هیئت رئیسه،
شورای انتظامی، بازرسین — which is the order the arkan page's own intro paragraph lists them in, and
the order the law gives. The dropdown, which used to be مدیره، رئیسه، بازرسین، انتظامی، مجمع, now
follows it. Either order is one number away in the panel once step 4 lands.

## Notes for whoever does this next

- **There is no `dotnet` on the production host.** Builds run in `mcr.microsoft.com/dotnet/sdk:10.0`.
  Run the container as `$(id -u):$(id -g)` with `HOME=/tmp` so nothing in the git tree ends up
  root-owned, and install the EF tool with `--tool-path /tools` on a mounted volume — a `-g` global
  tool lands in the container's ephemeral `$HOME` and is gone on the next run.
- Persistent caches now exist at `/data/apps/nuget-cache` and `/data/apps/dotnet-tools`; the first
  restore took about two minutes, later ones are quick.
- `dotnet ef migrations script` writes a **UTF-8 BOM**. Concatenate it after anything else and
  sqlcmd fails with `Incorrect syntax near '?'`. Strip it with `sed '1s/^\xEF\xBB\xBF//'`.
- `SET XACT_ABORT ON` dooms the transaction on *any* error, including one caught by `TRY/CATCH`. A
  deliberate constraint-violation test therefore poisons everything after it — run negative tests in
  their own pass.

## Next

Step 2: the application layer and endpoints for contact sections and channels, the DTO changes, and
`contactSections` in the content payload. The migration applies when the API is next deployed.
