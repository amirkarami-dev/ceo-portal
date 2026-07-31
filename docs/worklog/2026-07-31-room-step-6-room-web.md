# Room step 6: `room-web` — my meetings, admin table, create/edit

- **Date:** 2026-07-31
- **Area:** room / front end / IdP
- **Branch / commits:** `main` — uncommitted at time of writing
- **Status:** built, typechecks, lints, shell verified in a browser. **The signed-in screens have not
  been driven** — see «Not verified».

## Goal

Step 6's success criterion: **a meeting can be created end to end**.

## What changed

**New SPA — `room-web`, the seventh in the family, dev port 5277.**

- Scaffolding copied verbatim from `election-web` where it is meant to be identical: `src/theme/*`,
  `AppSwitcher.tsx`, `PageHeader`, `JalaliFields`, `AuthProvider`, `useAuth`, eslint/tsconfig, nginx.
- `src/lib/types.ts` — numeric const-object enums, the wire helpers, and a client-side mirror of the
  four type/join-mode rules.
- `src/lib/queries.ts`, `src/lib/api.ts` — TanStack Query hooks and the Persian-error-preserving client.
- `src/features/rooms/RoomsList.tsx` — the admin table, with the join link and a copy button on the row.
- `src/features/rooms/RoomForm.tsx` — create/edit, the presenter picker, and the invite list.
- `src/features/rooms/PersonField.tsx` — a کد ملی box that shows whose it is.
- `src/features/meetings/MyMeetings.tsx` — the attendee's cards.
- `deploy/Dockerfile.room-web`, `.claude/launch.json`, `AGENTS.md` port table.

**Backend — one small addition.**

- `GET /api/RoomAdmin/people/{nationalCode}` → the name on file. This is the follow-up step 5 recorded:
  the API refuses any presenter or invite that is not a real کد ملی, so without a lookup the admin
  panel is a ten-digit box that only reports a typo after a failed save. Four functional tests.

**IdP — the wiring without which step 6 cannot be run at all.**

- `ServiceKeys.Room` (grantable, so the launcher can show a tile).
- `room-web` **deliberately absent from `ClientToKey`**, like `election-web`: who may attend a meeting
  is that meeting's invite list or its link. An engineer carrying `["walfare"]` who is invited to a
  جلسه must still be able to sign in, and mapping the client here would refuse them at authorize.
- `EngineerLoginClients["room-web"] = "room"` → کد ملی + کد پیامکی, not a password prompt.
- The `room-web` OIDC client seed, and `Clients:RoomWeb:*` + CORS in `Auth/appsettings.Development.json`.

The design doc puts «OIDC client» under step 10. It is here instead because step 6's criterion is
*create a meeting end to end*, and nobody can reach a single screen of this app without it. The
production redirect URIs, compose entry and the AppSwitcher sync across the other six SPAs remain
step 10.

## Decisions

- **The type/join-mode rules are mirrored on the client, and that does not weaken them.** They are
  CHECK constraints in the database and a validator in the API; the copy in `types.ts` only stops an
  admin filling in a whole form to be refused at save. Changing the type also **rewrites the join mode**
  if the current one is now illegal — otherwise switching «جلسه» to «ارائه» silently leaves
  «فقط دعوت‌شدگان» selected, which the database refuses.
- **The presenter box resolves the name while you type.** Persian digits are converted to ASCII on
  every keystroke, because the API compares کد ملی exactly and «۵۵۵…» would look like a missing member.
  The check is a convenience and never the gate — the server looks the person up again on save.
- **The copy button does not use `navigator.clipboard` alone.** That API is undefined on plain http,
  which is exactly how this app is reached in dev (`http://room.localhost:5277`) — so the obvious
  one-liner throws on the one screen where copying is the entire point. There is a textarea fallback.
- **No «ورود» button on the attendee cards yet.** The meeting screen is step 8 and the link landing page
  is step 7, so a join button would lead to a route that does not exist. The cards show what there is
  to know; the button arrives with the screen it opens.
- **The invite box is React state, not an AntD form field.** It lives inside the meeting form, and a
  field there would be submitted and validated along with the meeting.
- **`strictPort: true`** on 5277. The port is not cosmetic — the IdP redirect URI and the API CORS entry
  are keyed to it, and silently landing on 5278 fails at the login redirect with an error that says
  nothing about ports.

## One bug found by looking at the screen

Clicking «ورود» reached the IdP correctly, but the engineer-login page was headed
**«سامانه رفاهی مهندسین»** — the welfare service. `EngineerLogin` picks its heading from a hint map that
had no `room` entry and falls back to welfare. The fallback is deliberate and correct (an unknown hint
must not be able to grant an arbitrary service), so the fix was to add the entry, not to change the
fallback. Nothing failed; the page simply told every meeting attendee they were signing in to the
welfare system.

## Verification

- `npm run build` (typecheck + vite) and `npm run lint --max-warnings 0` both clean.
- Solution builds; **unit 326 passed**, **functional 130 passed / 3 failed** — the same three
  pre-existing failures recorded in `2026-07-30-election-voter-flow.md`. Four of the passing ones are
  new, covering the people lookup including Persian digits, the outage-vs-not-found distinction, and
  that a non-admin cannot turn a کد ملی into a name.
- **In a real browser**, at `http://room.localhost:5277`:
  - the app boots with **no console errors**, redirects `/` → `/login`, and renders RTL Persian in both
    light and dark themes;
  - pressing «ورود» completes the OIDC round trip — the IdP log shows `Created OIDC client room-web`
    and the request arrives as `/Account/EngineerLogin?…&service=room`, which is the client
    registration, the redirect URI and the engineer-login mapping all confirmed at once;
  - after the fix, that page is headed «جلسات آنلاین».
- **Every route the SPA calls was probed from the browser**, and this is the check worth keeping: the
  seven authenticated paths answer **401, not 404**, so each one exists where the SPA thinks it does
  and is gated; and `GET /api/Room/j/{made-up token}` answers **404, not 401**, so the anonymous link
  route really is reachable with no bearer token and correctly refuses an unknown link.

## Not verified — and why

**Nobody has signed in.** Local login needs either the admin password (which I will not type) or an
engineer کد ملی resolved through the KurdNezam directory — and `ConnectionStrings:KurdNezamDb` is not
set in the dev config, so no کد ملی resolves locally.

So the admin table, the create/edit form, the presenter picker and «جلسات من» have **never been
rendered with data**. The step's criterion — *a meeting can be created end to end* — is proven at the
API level by the functional suite, and not yet through the screen.

To close it, Amir signs in at `http://room.localhost:5277` with the admin account and creates one
meeting. Everything else is running: `auth` on 5100, `api` on 5000, `room-web` on 5277.

## Follow-ups

- Step 7: `/j/:joinToken` — the landing page and the countdown.
- Step 8: `/room/:id` — the meeting screen, and the «ورود» button that opens it.
- Step 10 still owns: production redirect URIs, the compose service, CORS on the server, DNS, and
  syncing the `room` tile in `AppSwitcher.tsx` to the other six SPAs (it is only in `room-web`'s copy
  today, which is the same order `election` went in).
