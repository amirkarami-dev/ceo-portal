# Which parts of the fifth edition a project must obey, and when

- **Date:** 2026-08-17
- **Area:** mabhas19 (assessment-core + web)
- **Status:** design, nothing implemented yet
- **Source:** `docs/mabhas19/mab19-v5.pdf`, PDF page 64 — جدول ۱۹-۲-۱ «زمان‌بندی الزام اجرای
  بخش‌های مختلف ویرایش پنجم مبحث نوزدهم برای گروه‌های ساختمانی»

## Goal

*"'زمان اجرا' mean when create project calculate from 1404/10/19 to now … then according the table on
page 64 and according «گروه ساختمانی» show description about which section required"*.

So: a project's building group plus how long the fifth edition has been in force decides which
requirements apply to it. Today the app shows every section as «ناقص / ابتدا تکمیل کنید» regardless —
an engineer cannot tell which of them the regulation actually asks of *this* building *yet*.

## The table, transcribed

Twenty rows (4 groups × 5 years) × 24 requirement columns. `✓` = required, `✗` = not yet.

| گروه | زمان اجرا | طراحی | حین ساخت | پایان‌کار | عایق‌کاری | بازتاب نما | بازتاب بام | شیشه چندجداره | مقاومت حرارتی | SHGC | نشت نما | نشت حجمی | بازیافت حرارت | بازدهی تجهیزات | کنترل موتورخانه | شیر/جریان‌سنج | ۴ لوله | مدار اولیه/ثانویه | پمپ دورمتغیر | روشنایی هوشمند | شارژر برقی | پایش | زیرپایش | IBMS | تجدیدپذیر |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| الف | سال اول | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| الف | سال دوم | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| الف | سال سوم | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| الف | سال چهارم | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ |
| الف | سال پنجم | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✓ |
| ب | سال اول | ✗ | ✗ | ✗ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| ب | سال دوم | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| ب | سال سوم | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ |
| ب | سال چهارم | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ |
| ب | سال پنجم | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| ج | سال اول | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ |
| ج | سال دوم | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ | ✓ |
| ج | سال سوم–پنجم | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| د | سال اول | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ |
| د | سال دوم–پنجم | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

Rows collapsed above are identical in the document, cell for cell.

### How it was read, and why that matters

The marks are **not** text: both symbols are one private-use codepoint (`U+E10A`) with glyph id 0, in
one font, one size, one colour — a text extraction cannot tell ✓ from ✗, and 480 cells is far too many
to eye-ball safely. Each mark is a cloud of tiny filled rectangles, so they were classified by shape:
a ✗ puts ink in the top-left of its box (the top of one diagonal), a ✓ leaves the top-left empty and
carries its long stroke to the top-right. The measure came out **bimodal with nothing near the
threshold** (ticks ≈ 0.00, crosses ≈ 3.38), and about 60 cells across six rows were then checked
against the rendered page by eye — all agreed. 299 ✓ and 181 ✗.

Two results worth knowing before reading the table as "it ramps up smoothly":

- **گروه الف never requires the بازرسی stages** — all five years are ✗ for طراحی, حین ساخت and پایان‌کار.
- **IBMS is the last thing to land**: never for الف and ب, ج from year 3, د from year 2.
- **ب / سال دوم requires طراحی and پایان‌کار but not حین ساخت.** Verified twice; it is not a misread.

## The clock

The edition became binding on **۱۴۰۴/۱۰/۱۹**. Converted through Julian day numbers rather than by
hand: **1404/10/19 = 2026-01-07**. Bands are whole Jalali years from that day:

| band | starts | Gregorian |
|---|---|---|
| سال اول | ۱۴۰۴/۱۰/۱۹ | 2026-01-07 |
| سال دوم | ۱۴۰۵/۱۰/۱۹ | 2027-01-08 |
| سال سوم | ۱۴۰۶/۱۰/۱۹ | 2028-01-08 |
| سال چهارم | ۱۴۰۷/۱۰/۱۹ | 2029-01-07 |
| سال پنجم | ۱۴۰۸/۱۰/۱۹ | 2030-01-07 |

Today, 2026-08-17 = **۱۴۰۵/۰۵/۲۷**, is 222 days / 7 whole months in: **سال اول**, until 2027-01-08.

## What has to be decided

- **The band is frozen at project creation**, from `project.created` — reading the note as written
  ("when create project calculate … to now"). A project started in year 1 therefore keeps year-1
  duties into year 2. The alternative — recomputing against today, so a project's obligations grow
  while it is being built — is a different product rule, and the wrong one to pick by accident. Worth
  one confirmation before step 3.
- **Seven group codes, four table rows.** `calcBuildingGroup` returns `A, B, Bp, C, Cp, Cpp, D`; the
  table has الف، ب، ج، د. Map on the base letter: `B`/`Bp` → ب, `C`/`Cp`/`Cpp` → ج. The table's own
  footnote points at ماده ۱۲ آیین‌نامه اجرایی قانون نظام مهندسی, which is the four-group scheme.
- **Beyond سال پنجم** the document stops. Treat year 6+ as year 5 (everything its group ever
  requires), which is the only reading that does not silently drop duties.
- **Four columns have no checklist in the app**: نشت سطح نما and نشت حجمی (a test, not a checklist),
  انرژی تجدیدپذیر, and the three بازرسی stages. They must still be *shown* — a requirement with no
  tool is exactly the kind of thing a UI quietly loses.

## Requirement → app section

| app section | tool | table columns |
|---|---|---|
| پوسته خارجی (معماری) | `env_opaque.html` | عایق‌کاری پوسته خارجی، الزامات بازتاب نما، الزامات بازتاب بام |
| پوسته خارجی (معماری) | `env_trans.html` | شیشه چندجداره، حداقل مقاومت حرارتی، SHGC |
| تأسیسات مکانیکی | `mech_checklist.html` | بازیافت حرارت، بازدهی تجهیزات، کنترل موتورخانه، شیر/جریان‌سنج، ۴ لوله، مدار اولیه/ثانویه، پمپ دورمتغیر |
| تأسیسات الکتریکی | `elec_checklist.html` | روشنایی هوشمند، شارژر خودرو برقی |
| سامانه پایش | `monitoring_checklist.html` | پایش، زیرپایش |
| مدیریت یکپارچه | `integrated_mgmt.html` | سامانه مدیریت یکپارچه (IBMS) |
| — (no tool) | — | نشت سطح نما، نشت حجمی، انرژی تجدیدپذیر، بازرسی: طراحی/حین ساخت/پایان‌کار |

A section is **fully required** when all its columns are ✓, **partly required** when some are, and
**not yet** when none are. Partly is the common case and cannot be collapsed into either extreme:
in سال اول a group-ب building owes عایق‌کاری and شیشه چندجداره — 2 of the 6 envelope items — and
nothing else at all.

## Steps

1. **The table as data.** `packages/assessment-core/src/data/schedule19.ts`: the 24 requirement keys
   with Persian labels and their section/tool mapping, the 4×5 matrix, the group-letter mapping. Tests
   that pin the row totals (299 ✓ / 181 ✗), the three surprises above, and every requirement key
   mapping to a known tool or to the explicit "no tool" bucket.
2. **The clock.** Jalali↔Gregorian by Julian day number (the app has no date library), plus
   `complianceBandOf(date)` → 1…5. Tests on each boundary day, the day before it, and year 6+.
3. **The derived model.** `requiredForProject({ groupCode, created })` → per section: state,
   the required item labels, the not-yet item labels, and the band. Pure, tested.
4. **The panel on the project page** — «الزامات لازم‌الاجرا»: the band and its dates, then a row per
   section with its state and items, including the four unmapped requirements.
5. **The assessment workspace** — mark the sections that are not required yet, so an engineer filling
   checklists can see what is optional today. Do not block them; the rule is guidance, and a project
   may exceed it deliberately.
6. **The report.** Decide whether the PDF states the band and the applicable requirement set. It is
   the artifact an inspector reads, so this is probably yes — but it is the C# side and a separate
   decision.
7. **Worklog + GOTCHAS**, including how this PDF's marks must be read.
