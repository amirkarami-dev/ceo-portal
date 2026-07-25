# FarsNezam Magic-Link Onboarding + Typ-Gated Assessment

- **Date:** 2026-06-10
- **Status:** Approved (design); implementation in progress
- **Scope:** External FarsNezam SQL Server integration → auto-auth → project provisioning → section edit-gating → modern assessment card UI

## User journey

One link from the FarsNezam portal:
`https://mabhas19.myceo.ir/sso/fars?co=<CodeOzveyat>&pno=<ProjectNo>`
1. **Auth** — look up `co` in `tblAzayeSazmanMain.CodeOzveyat`; provision an IdP user (`UserName = CodeMeli`, `Email = <CodeMeli>@mabhas19.myceo.ir`, phone = `Mob`); sign them in.
2. **Provision** — look up `pno` in `tblProject`; create the project for that user (idempotent on `OwnerId+Source+ExternalId`); store allowed sections from `tblHoghoghiProjectList.Typ`.
3. **Land** on the redesigned project page → assessment sections as modern cards; only typ-matched sections editable, the rest read-only.

## Decisions (from brainstorming)

- **Link security:** plain `co`+`pno`, **no signature** — impersonation risk explicitly accepted by the user. Cheap no-portal-change guards still added (reject unknown `co`/`pno`, mark provisioned accounts, rate-limit the SSO endpoint).
- **Network:** the production server is internet-capable, so this is wired for prod too; connection string stored via **SOPS** (`deploy/prod.enc.env`), never hardcoded.
- **Edit gating:** only sections whose typ is in the project's list are editable; **mon + bms (no typ) are always read-only** in this flow.
- **Typ filter:** by `ProjectNo` (per the spec). Alternative (tighten to the engineer's own `Ozviat`) noted as a possible follow-up.

## External schema → app mapping (introspected 2026-06-10, read-only)

**`tblMap_TypMohandes`** (`Id` tinyint, `Onvan` nvarchar): `1=طراح معماری→env`, `3=طراح برق→elec`, `4=طراح مکانیک→mech`. (`2=سازه` and all others → no Mabhas19 section.)

**`tblAzayeSazmanMain`** (engineer): `OzveyatID` int PK · `CodeOzveyat` bigint (**the `co` key**) · `CodeMeli` nvarchar (**→ username + email local-part**) · `FirstName`/`LastName`/`NameKhanevadegi` · `Mob` nvarchar (→ phone).
- Lookup: `SELECT TOP 1 OzveyatID, CodeMeli, FirstName, LastName, NameKhanevadegi, Mob FROM tblAzayeSazmanMain WHERE CodeOzveyat=@co`.

**`tblProject`** (`ProjectNo` nvarchar = lookup key) → `ExternalProjectDto`:
| App field | Source column |
|---|---|
| Client | `karfarma` |
| UnitCount | `TedadVahed` |
| FloorCount | `TedadSaghf` |
| TotalArea | `Zirbana` (fallback `masahat`) |
| Address | `AddressMahal` |
| Deed (پلاک ثبتی) | `shomarehpelak` |
| Parcel (شماره قطعه) | `Qate` |
| Title | `"پروژه " + ProjectNo` |
| City | **default `شیراز`** (no city column; Fars province) — `FarsNezam:DefaultCity`, configurable |
| ClimateCode | computed from City (`شیراز`→`3B`) |
| ExternalId | `ProjectNo` |

**`tblHoghoghiProjectList`** (`ProjectNo` nvarchar, `Typ` tinyint, `Active` bit, `Ozviat` int):
- Allowed sections: `SELECT DISTINCT Typ FROM tblHoghoghiProjectList WHERE ProjectNo=@pno AND Active=1` → map {1→env,3→elec,4→mech} → `AllowedSections`.

## Components (each isolated; follows existing patterns)

### 1. FarsNezam read access (Infrastructure, raw `Microsoft.Data.SqlClient`, read-only)
- `FarsNezamOptions` (`ConnectionStrings:FarsNezamDb` + `FarsNezam:DefaultCity`, `Enabled`).
- **API side** `IFarsNezamProjects` → `GetProjectByNoAsync(pno)`, `GetAllowedSectionsAsync(pno)`.
- **IdP side** (`src/Auth`) `IFarsNezamDirectory` → `GetEngineerByCodeOzveyatAsync(co)` (engineer lookup for provisioning).
- No second EF context / no migration against FarsNezam. Raw parameterized SQL only.

### 2. Auto-auth (IdP, reuses OTP provisioning pattern)
- Web starts `signIn("mabhas19", …, { login_hint: "fars:<co>" })`.
- `AuthorizationController` (`src/Auth`): on an **unauthenticated** authorize request whose `login_hint` starts `fars:`, redirect to a new **`/Account/FarsLogin?co=<co>&returnUrl=<authorize>`** page instead of the normal login.
- `FarsLogin`: validate `co` via `IFarsNezamDirectory`; find-or-create `AuthUser { UserName=CodeMeli, Email=<CodeMeli>@mabhas19.myceo.ir, EmailConfirmed=true, PhoneNumber=Mob }`; `signInManager.SignInAsync`; redirect to `returnUrl` → OIDC issues code → web session.

### 3. Project provisioning (API)
- New `ProjectSource.FarsNezam`; `FarsNezamProjectProvider : IExternalProjectProvider` (same `IEnumerable<IExternalProjectProvider>` dispatch the existing نظام‌مهندسی import uses).
- Extend the import handler (or a thin `ImportFarsNezamProjectCommand`) to also fetch the typ list and set `Project.AllowedSections`; **idempotent** on `(OwnerId, Source=FarsNezam, ExternalId=pno)` — re-clicking the link returns the existing project.
- `Project.AllowedSections` (new `string?` column, e.g. `"env,elec"`).

### 4. Web entry routes
- `/[locale]/sso/fars` — **public** (added to `middleware.ts`): reads `co`,`pno`; `signIn("mabhas19", { callbackUrl: "/sso/fars/finish?pno=<pno>" }, { login_hint: "fars:<co>" })`.
- `/[locale]/sso/fars/finish?pno=` — authenticated: POST the FarsNezam import, then redirect to `/projects/{id}`.

### 5. Gating + DTO
- `ProjectDto` gains `projectNo` (= ExternalId) + `editableSectionKeys: string[]` (from `AllowedSections`). EF migration on **our** DB; regenerate `@mabhas19/api-types`.
- `AssessmentWorkspace` gains `editableSections?: Set<string>`; sections not in the set render read-only (disabled overlay + lock + «فقط خواندنی»). Default (no allowlist, e.g. manually-created projects) = all editable (backward compatible).

### 6. UI redesign (modern cards — `/ui-ux-pro-max` + `/frontend-design`)
- `AssessmentWorkspace` section list → modern cards: color accent, title, tool(s) + score progress, editable «ویرایش» vs read-only lock badge. Light/dark, RTL, emerald. Project detail stays friendly (existing redesigned detail + per-section report panel already shipped).

## Flow
```
FarsNezam portal link  ─▶  /sso/fars?co&pno
  └─ signIn(login_hint="fars:<co>", callbackUrl=/sso/fars/finish?pno)
      └─ IdP /connect/authorize (no session, login_hint=fars:*)
          └─ /Account/FarsLogin?co&returnUrl  → validate co → provision AuthUser → SignInAsync
              └─ back to /connect/authorize → code → web callback → SESSION
                  └─ /sso/fars/finish?pno → POST import (FarsNezam) → project {id} (idempotent)
                      └─ redirect /projects/{id}  → assessment sections (typ-gated)
```

## Security (accepted risk, recorded)
Plain `co`+`pno` = anyone with a valid membership code + project number can impersonate the engineer. Guards added without portal changes: unknown `co`/`pno` rejected; provisioned accounts flagged (`Source`-like marker); SSO endpoint rate-limited. Recommended hardening (HMAC-signed link) deferred at user request.

## Implementation phases
1. Infra: `FarsNezamOptions` + `IFarsNezamProjects` (API) + `IFarsNezamDirectory` (IdP) + DI + config/SOPS + `ProjectSource.FarsNezam`.
2. Provisioning: `FarsNezamProjectProvider` + import handler extension + `Project.AllowedSections` column + migration + idempotency.
3. Auth: `FarsLogin` page + `AuthorizationController` `login_hint` routing.
4. DTO + types: `projectNo`/`editableSectionKeys` on `ProjectDto`, regenerate api-types.
5. Web: `/sso/fars` + `/sso/fars/finish` routes + middleware public allowance.
6. UI: `AssessmentWorkspace` modern cards + read-only gating; pass `editableSections` from the assessment page.
7. Verify: backend build/test, web build/lint, live preview drive-through; introspect a real `(co,pno)` and produce one working test URL.

## Out of scope (v1)
HMAC link signing; per-engineer (Ozviat) typ filtering; writing back to FarsNezam; syncing engineer profile changes; mobile app.
