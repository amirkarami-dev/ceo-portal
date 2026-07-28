# task service — design

> **Date:** 2026-07-28 · **Status:** design saved, NOT started · **Author:** Amir + Claude

A Monday-style task board for the CEO Portal, at **`task.kurdnezam.ir`**.
Nothing is built yet. This file is the agreed design; build it later together.

---

## 1. Goal

A small task board. An admin makes tasks, gives each one an owner and a deadline, and watches the
status. Everyone else sees the board and updates their own tasks.

Copy Monday's **look and feel**, not its feature list. See §8 for what the screenshots show.

## 2. Non-goals

- **No plans, no subscriptions, no billing.** Monday's "See plans" button does not exist here.
- No custom columns. The four columns are fixed: Name, Owner, Status, Due date.
- No automations, no AI, no integrations, no time tracking, no file uploads in v1.
- No new database server. This lives in the existing `CeoDb`, like every other feature.
- No second identity system. The central OIDC IdP (`auth.myceo.ir`) stays the only token issuer.

## 3. Decisions already made

| Question | Decision | Why |
|---|---|---|
| employee / accountant / developer | **Job titles, not permissions** | In a task app they would all do the same things. Real roles that grant nothing are dead weight. Stored as a `JobTitle` field, used for filtering and display. |
| Who can own a task | **Only people invited to task** | The service keeps its own member list. Matches the "Invite / 1" counter in the screenshots and keeps the Owner dropdown short. |
| Board model | **One board, groups + tasks** | Exactly what the screenshots show. Multiple boards and custom columns are much bigger and are not needed to be useful. |
| Language / direction | **Persian, RTL** | Matches every other app in the portal. The screenshots are English LTR — that is only the reference for *layout*, not for language. |
| Dates shown to the user | **Jalali (Persian calendar)** | See §8.4. Stored and sent as ISO; converted only in the browser. |

Only two permission levels exist: **`Administrator`** and **`User`** — the roles this backend
already has in `src/Domain/Constants/Roles.cs`. No new roles are added.

| Can… | Administrator | User |
|---|---|---|
| See the board | yes | yes |
| **Create a task** | **yes** | **no** |
| Assign / change the owner | yes | no |
| Set / change a deadline | yes | no |
| Change status of a task | any task | **only tasks they own** |
| Delete a task | yes | no |
| Invite a member, set job titles | yes | no |

**A User has exactly one write action: move their own task's status.** Everything else is read-only.
That is the whole permission model — keep it that simple.

What this means in the UI (do not just hide buttons — the API enforces it too):

- `New task` button and every `+ Add task` row: **admin only**.
- Owner cell and Due date cell: read-only text for a User, editable for an admin.
- Status cell: editable **only on rows the User owns**; read-only on everyone else's.
- Kanban drag: a User can drag their own cards between columns, nothing else.

## 4. ⚠ Naming trap — do not call the entity `Task`

`Task` is `System.Threading.Tasks.Task` in C#. A domain class called `Task` would shadow it in every
`async` method in the same namespace and produce confusing errors. **Name the entity `TaskItem`.**
The service, the URL and the product are still called "task" — only the C# type differs.

This is the same shape as the two naming traps already in `GOTCHAS.md` (the `ValidationException`
ambiguity and the Aspire `Projects` namespace clash). Add it there when the work starts.

## 5. Architecture

A new feature folder inside the **existing** Clean Architecture backend — the same pattern as
`MunSanandaj` and `Analytics`. It ships inside the **same `api` container**, uses the same `CeoDb`,
the same IdP and the same Traefik.

```
task-web (Vite + React 19 + AntD 6)        task.kurdnezam.ir
   │  OIDC PKCE, client "task-web"
   ▼
src/Web/Endpoints/Task/*                   /api/Task/*
   ▼
src/Application/Task/*                     CQRS handlers (MediatR 12.5.0)
   ▼
CeoDb: task_boards, task_groups, task_items, task_members
```

## 6. Data model

Four tables in `CeoDb`, all `BaseAuditableEntity` (free `Created` / `CreatedBy` /
`LastModified` / `LastModifiedBy`).

### `task_members` — who may use the service
| Column | Type | Notes |
|---|---|---|
| `Id` | int PK | |
| `SubjectId` | string, indexed unique | the OIDC `sub` from the IdP — the join key to the identity |
| `Email` | string | copied at invite time, for display before first login |
| `DisplayName` | string? | filled from the token on first login |
| `JobTitle` | string | `Employee` / `Accountant` / `Developer` — a label, not a permission |
| `IsActive` | bool | soft removal; keeps old task owners resolvable |

### `task_notifications` — the bell
| Column | Type | Notes |
|---|---|---|
| `Id` | int PK | |
| `MemberId` | int, indexed | who it is for |
| `TaskItemId` | int | what it is about |
| `Kind` | string enum | `DueTomorrow` · `Overdue` |
| `DueDateAtSend` | DateOnly | the deadline this notification was about |
| `IsRead` | bool | |
| `CreatedAt` | DateTimeOffset | |

**Unique index on `(MemberId, TaskItemId, Kind, DueDateAtSend)`.** This is what stops duplicates:
the daily job can run twice, or the container can restart mid-run, and the same person still gets
told once. Including `DueDateAtSend` in the key is deliberate — if an admin moves the deadline, the
task legitimately becomes "due tomorrow" again and should notify again.

### `task_boards` — one row in v1
| `Id` int PK · `Name` string (the screenshots call it "ceo") |

### `task_groups` — the coloured sections
| Column | Type | Notes |
|---|---|---|
| `Id` | int PK | |
| `BoardId` | int | |
| `Name` | string | "To-Do", "Completed" |
| `Colour` | string | hex, drives the left bar and the group title |
| `SortOrder` | int | |

### `task_items` — the rows
| Column | Type | Notes |
|---|---|---|
| `Id` | int PK | |
| `GroupId` | int, indexed | |
| `Title` | string | |
| `OwnerMemberId` | int? | null = Unassigned (grey avatar in the screenshots) |
| `Status` | string enum | `NotStarted` · `WorkingOnIt` · `Stuck` · `Done` |
| `DueDate` | DateOnly? | the deadline |
| `CompletedAt` | DateTimeOffset? | set when Status becomes `Done` |
| `SortOrder` | int | drag order inside a group |

**Why `DateOnly` and not a timestamp:** a deadline is a day, not an instant. Storing a
`DateTimeOffset` would drag time-zone bugs into every "is it overdue?" check. Overdue is computed
as `DueDate < today` in Tehran time, on the server.

**Jalali dates:** the API sends and receives ISO (`2026-07-28`). Conversion to the Persian calendar
happens only in the browser. This repo already has a rule about this — see the Jalali entries in
`GOTCHAS.md`, especially *never* run an already-Jalali string through `new Date()`.

## 7. API — `/api/Task/*`

Auto-mapped from `IEndpointGroup` classes, like every other endpoint group here.

| Method | Route | Who |
|---|---|---|
| GET | `/api/Task/Board` | any member — board + groups + items + members, one payload |
| POST | `/api/Task/Items` | **admin only** |
| PUT | `/api/Task/Items/{id}` | **admin only** — title, owner, deadline, group |
| PATCH | `/api/Task/Items/{id}/status` | admin, **or the owner of that task** |
| PUT | `/api/Task/Items/{id}/move` | **admin only** — reorder / move between groups |
| DELETE | `/api/Task/Items/{id}` | **admin only** |
| GET/POST | `/api/Task/Members` | admin — list / invite |
| PUT | `/api/Task/Members/{id}` | admin — job title, deactivate |

**Status is its own endpoint on purpose.** It is the single field a non-admin may write. Splitting
it out means the ownership check lives in one small handler, instead of a general "update task"
handler that has to work out which fields the caller is allowed to touch — the kind of branching
where a permission bug hides.

`RequireRole(Administrator)` covers every route except `GET /api/Task/Board` and
`PATCH /Items/{id}/status`. Those two check membership, and status additionally checks
`item.OwnerMemberId == caller's member id` unless the caller is an admin.

**Kanban drag for a User** goes through `PATCH /status`, not `/move` — dragging a card between
status columns is a status change, not a reorder.

`GET /api/Task/Board` returning everything in one call is deliberate: the board is small (tens of
rows), and one payload avoids the waterfall that a `/groups` → `/items` → `/members` chain creates.

## 7.1 Deadline notifications

**In-app only.** A bell icon with an unread count, exactly like the Notifications panel in the
screenshots. No SMS, no email.

Why not SMS: `MihanSmsSender` lives in `src/Auth` and serves OTP. The API cannot call it today —
it would need sharing into `Infrastructure` or an internal Auth call, plus a phone number on every
member, plus a cost per message. Not worth it for v1. Email is bigger still: this repo has **no**
email sender at all. Both stay possible later; the notification row is the same either way, only
the delivery changes.

### When it fires

A **daily job** at **08:00 Tehran time**, writing at most two notifications per task:

| Kind | Condition |
|---|---|
| `DueTomorrow` | `DueDate == tomorrow` and status is not `Done` |
| `Overdue` | `DueDate < today` and status is not `Done` |

`Done` tasks never notify. A task that is already overdue notifies **once**, not every morning —
the unique index guarantees that.

### ⚠ Two traps to get right

**1. `new PeriodicTimer(TimeSpan.FromHours(24))` does not run at 08:00.** It fires 24 h after the
container started, so a deploy at 15:20 moves every future notification to 15:20. Compute the delay
to the next 08:00 Tehran, `await Task.Delay(thatDelay)`, and only then start the 24 h timer. The
MunSanandaj workers do not need this because a 12 h sync does not care what time it runs — this one
does.

**2. "Tomorrow" and "today" must be Tehran days, not UTC days.** The container runs UTC. At 22:00
Tehran it is already the next day in UTC, so a naive `DateTime.UtcNow.Date` would notify a day
early. Resolve today from the Tehran time zone, then compare to the stored `DateOnly`. This is the
same reason §6 stores the deadline as a `DateOnly` and §8.4 computes overdue on the server.

### API

| Method | Route | Who |
|---|---|---|
| GET | `/api/Task/Notifications` | the caller's own, newest first, with an unread count |
| POST | `/api/Task/Notifications/read` | mark all, or a list of ids, as read |

A member can only ever read or mark their **own** rows — `MemberId` comes from the token, never
from the request body.

The board page already polls; the bell can piggyback on the same `GET /api/Task/Board` response by
including `unreadNotificationCount`, so v1 needs no extra polling loop.

## 8. Frontend — `task-web`

Vite + **React 19** + **AntD 6.5.2** (verified stable, `latest` on npm) + TypeScript.

Same folder shape as the other five SPAs so it is not a special case:
`src/{api,auth,query,theme,layout,pages,components/ui}` — see
[`.github/instructions/spa-frontends.instructions.md`](../../../.github/instructions/spa-frontends.instructions.md).

### State
- **TanStack Query** for everything from the server. It is already the pattern in this repo.
- **Zustand** only for real UI state that several components share (open item panel, active filters,
  table vs Kanban). Small, no boilerplate.
- No Redux. There is no state here that justifies it.

### The design system — what you asked for
Do it in this order, or the "own components" layer never actually happens:

1. **Tokens first.** One `src/theme/tokens.ts`: colours, spacing scale, radius, font sizes. Feed it
   into AntD 6's `ConfigProvider` theme (`token` + `components`). Nothing hardcodes a hex.
2. **Wrap before you use.** Pages import from `src/components/ui`, never from `antd` directly.
   Start with the few that matter: `Button`, `Tag`, `Avatar`, `Modal`, `Field`. Each is a thin
   wrapper that fixes the props this product always passes.
3. **Grow it as you go.** When a third page needs the same thing, promote it into `components/ui`.
   Do not try to design the whole system up front — that always produces components nobody uses.

Keep the `components/ui` export surface stable: restyle, don't rename. Every page imports from it.

### 8.4 Persian, RTL and the Jalali date picker

The whole app is **Persian and RTL**. `<html lang="fa" dir="rtl">`, AntD's
`<ConfigProvider direction="rtl" locale={faIR}>`, and logical CSS properties everywhere
(`margin-inline-start`, `inset-inline-end` — never `left` / `right`).

**Dates are Jalali in the UI, ISO on the wire.** The API always sends and accepts `2026-07-28`.
Nothing Jalali ever reaches the database.

#### Which picker — checked, not assumed

`antd-jalali@2.0.1` is what `walfare-web` uses, but its peers are **`antd ^5.18.3`,
`react ^18.3.1`**. task-web is **AntD 6 + React 19**, so that is a major-version mismatch, not just
a peer warning. `walfare-web` already needs `--legacy-peer-deps` for this exact package
(see `GOTCHAS.md`), and that only papers over React 18 vs 19 — not AntD 5 vs 6.

So I checked what AntD 6 actually ships (unpacked `antd@6.5.2`):

- `es/date-picker/generatePicker/index.js` **still exists**, and still exports the same
  `generatePicker = generateConfig => {…}` factory returning `DatePicker` with `.RangePicker`,
  `.MonthPicker`, `.YearPicker` etc.
- `es/locale/fa_IR.js` and `es/date-picker/locale/fa_IR.js` **both ship**.

**Decision: build our own `JalaliDatePicker` in `components/ui`** from AntD 6's own
`generatePicker` plus a Jalali-configured dayjs. That is exactly what `antd-jalali` does inside, so
we lose nothing — and we drop a dependency that declares the wrong AntD and React majors. It also
fits the "build your own design system" goal: the picker becomes a component we own.

Fallback if `generatePicker` turns out to be awkward: **`react-multi-date-picker@4.5.2`**, whose only
peer is `react >=16.8` — no AntD dependency at all, so the AntD 6 question cannot bite. Cost: it
does not inherit the AntD theme, so it needs styling to match.

`jalaali-js@2.0.0` (pure date maths, no UI, no peers) is available if the server ever needs Jalali
conversion — it should not, because the server stays ISO.

#### Jalali rules already paid for in this repo — do not rediscover them

From `GOTCHAS.md`, all learned the hard way in `walfare-web`:

- **Never load a second `jalaliday`.** Whatever extends dayjs must do it once. A second copy
  double-patches the prototype and the picker breaks.
- **Never call `d.calendar("jalali")` on a picker value.** `dayjs/plugin/calendar` overrides
  `.calendar()` and returns a string. Format directly instead.
- **Never put an already-Jalali string through `new Date()`.** `"1405/03/16"` would be read as
  Gregorian year 1405. Only convert values that are genuinely Gregorian.

#### Where a date appears

| Place | Shows | Sends |
|---|---|---|
| Due date cell | Jalali, e.g. `۶ مرداد` | ISO `2026-07-28` |
| Due date picker in the item panel | Jalali month grid | ISO |
| Kanban card date chip | Jalali short | — |
| Overdue check | computed on the **server**, Tehran time | boolean flag in the payload |

Overdue is computed server-side on purpose. Doing it in the browser means every user's machine
clock and time zone can disagree about whether a task is late.

### Screens
| Route | What |
|---|---|
| `/` | Board — table view: groups, rows, inline edit of Owner / Status / Due date |
| `/` (Kanban tab) | Same data as four status columns |
| `/members` | Admin only — invite, job title, deactivate |

Persian numerals (`۱۲۳`) for dates and counts, via `toLocaleString("fa-IR")` — the same thing
`kurdnezam-web` and `analytics-web` already do.

### UI reference — read from the screenshots
Recorded here because the PNGs are not in the repo:

- **Left rail**, ~64 px, icon + tiny label, collapsible.
- **Board header**: board name with a chevron, then a tab row — `Main table` / `Kanban` / `+`.
- **Toolbar**: `New task` (primary, split button), Search, Person, Filter, Sort, Hide, Group by, `…`.
- **Group section**: a coloured collapse arrow + coloured group name, then the table. A coloured
  bar runs down the left edge of the rows.
- **Columns**: checkbox · Task · Owner (round avatar, grey outline when unassigned) · Status ·
  Due date · `+`.
- **Status cells are full-bleed colour blocks with white text** — this is the strongest Monday
  signal. Green `Done`, orange `Working on it`, red `Stuck`, grey `Not Started`.
- **Done rows strike through the due date** and show a green tick.
- **Summary strip** under each group: a stacked colour bar for status mix, and a date range pill.
- **Kanban**: one column per status, coloured header with a count, cards showing title, status tag,
  due-date chip and owner avatar.
- **Item panel** opens over the board: left = fields (Group, Name, Owner, Status, Due date),
  right = Updates / Files / Activity Log tabs.
- **Invite dialog**: email box + role select + Invite button.
- **Filter popover**: counts per value, grouped by column, "Clear all" + "Save to this view".

Copy the *structure and the colour language*. Do not copy Monday's logo, wordmark or illustrations.

### Local dev
Port **5276** — the next free one after walfare-web (5275). Add it to `.claude/launch.json`,
browse it at `http://task.localhost:5276`, and add that origin to the API and IdP dev CORS lists.

## 9. Invite flow

1. Admin types an email in task-web.
2. `POST /api/Task/Members` calls the IdP's existing admin endpoint to create or find the user, then
   writes a `task_members` row with the returned `sub`.
3. The person signs in through the normal OIDC flow. First login fills `DisplayName` from the token.

No new sign-in method and no second user table — `task_members` only records *who may use this app*.

## 10. Deployment

- New service in `deploy/docker-compose.newserver.yml`, copying the `walfare-web` block (nginx SPA,
  own Dockerfile, Traefik router).
- **Certificate: use `httpresolver`.** `task.kurdnezam.ir` sits under `kurdnezam.ir`, which points
  straight at the box, so HTTP-01 works — the same as `refahi.kurdnezam.ir`. Do **not** use
  `myresolver`; its DNS-01 renewals fail with an ArvanCloud 403 (see `OPERATIONS.md`).
- Seed a `task-web` public PKCE client in `AuthDbInitialiser`, guarded the same way `AnalyticsWeb`
  is — skipped when its redirect URI is unset. Add `Clients__TaskWeb__*` to the `auth` service env.
- Add the new origin to `Cors__AllowedOrigins__*` on both `api` and `auth`.
- **User action:** add a `task.kurdnezam.ir` DNS record pointing at `185.206.94.116`.
- Deploy with the incremental loop (build one service, `up -d --no-deps`), or the new deploy console.

### Cost you should know about
`src/layout/AppSwitcher.tsx` is **byte-identical across five SPAs today**. Adding task to the
launcher means editing one, copying it to the other five, and **rebuilding all six** — otherwise the
ones you skip keep serving a launcher without the task link. This is already a `GOTCHAS.md` entry.

## 11. Build order

Each step ends in something you can actually look at.

| # | Step | Done when |
|---|---|---|
| 1 | `TaskItem` etc. + EF migration + seed one board, two groups, sample members | migration applies on API start; rows exist in `CeoDb` |
| 2 | `GET /api/Task/Board` + members endpoints | `/scalar` returns the board payload for an admin |
| 3 | Scaffold `task-web`, theme tokens, `ConfigProvider` (RTL + `fa_IR`), 4–5 wrapped `components/ui`, **and the `JalaliDatePicker` spike** | app boots on 5276, sign-in works, and the Jalali picker renders a correct month grid |
| 4 | Table view — groups, rows, coloured status cells, owner avatars, due dates | board renders the seeded data |
| 5 | Admin create / edit / delete; owner-only status change; permission rules | signed in as a `User`: no New task button, owner and due date read-only, status editable only on own rows — and the API rejects it even if the UI is bypassed |
| 6 | Kanban view + drag between columns | dragging changes status and persists |
| 7 | Members page + invite | invited person can sign in and see the board |
| 8 | Deadline notifications: `task_notifications`, the daily 08:00 worker, bell UI | a task due tomorrow produces exactly one row; running the job twice produces no second row |
| 9 | Filter / sort / search, empty states, mobile | works at 375 px with no sideways scroll |
| 10 | Deploy: compose, Dockerfile, IdP client, CORS, DNS, AppSwitcher in all six | `https://task.kurdnezam.ir` serves it |

## 12. Sample data to seed

Four members, so "admin assigns to other people" is testable from the first run:

| Name | Job title | Role |
|---|---|---|
| Amir Karami | — | Administrator |
| (sample) | Employee | User |
| (sample) | Accountant | User |
| (sample) | Developer | User |

Plus one board "ceo", groups "To-Do" and "Completed", and three tasks covering
`WorkingOnIt`, `Done` and `Stuck` — matching the screenshots.

## 13. Open questions — answer before step 1

1. ~~Persian/RTL?~~ **Answered 2026-07-28: yes, Persian + RTL, with a Jalali date picker.** See §8.4.
2. ~~Who is the admin?~~ **Answered 2026-07-28: the existing `Administrator` role.** Current portal
   admins get task admin automatically. No new role, no separate admin list.
3. ~~Does a deadline notify anyone?~~ **Answered 2026-07-28: yes — in-app bell only, daily at 08:00
   Tehran, `DueTomorrow` + `Overdue`.** See §7.1.
4. ~~Can a User create tasks?~~ **Answered 2026-07-28: no — only the admin creates tasks.** A User's
   only write action is changing the status of a task they own.
