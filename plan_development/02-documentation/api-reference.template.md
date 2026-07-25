# API Reference — `<PROJECT_NAME>`

> Table-based API reference template, derived from the reference project (Mabhas19).
> Replace every `<PLACEHOLDER>`. The filled tables below are the **worked Mabhas19 example** —
> rename groups/paths to match your project, but keep the column shape.

## Conventions

- **Base path:** `/api/`. Port **5000** in development, **8080** in containers, behind the reverse proxy in production (`https://<API_DOMAIN>`).
- **Endpoint groups auto-map** to `/api/{ClassName}`: each `IEndpointGroup` class in `src/Web/Endpoints` becomes a route group named after the class. So a `Projects` class -> `/api/Projects`.
- **Authentication is OAuth2 / OIDC via an external IdP** (OpenIddict at `https://<AUTH_DOMAIN>`). The API is a **resource server**: it **validates** the IdP's signed JWTs via `AddJwtBearer` (authority = the IdP, audience = `<PROJECT>.api`, JWKS-verified) and **does NOT issue tokens**. There are **no username/password, OTP, or Google endpoints on the API** — all login methods live in the IdP. Clients obtain tokens from the IdP and present them as `Authorization: Bearer <jwt>`.
- **Auth column:** **No** = anonymous; **Yes** = requires a valid OIDC JWT (`Authorization: Bearer <jwt>`); **Admin** = requires the `Administrator` role (`/api/Admin/*`).
- **Interactive docs (Scalar):** `http://localhost:5000/scalar` in dev, `https://<API_DOMAIN>/scalar` in prod.
- **Errors:** RFC 7807 problem-details. `400` validation (FluentValidation; field-keyed `errors`), `401` no/expired token, `403` `ForbiddenAccessException`, `404` `Guard.Against.NotFound`.

---

## Endpoint summary (all groups)

| Group | Method | Path | Purpose | Auth |
|-------|--------|------|---------|------|
| Users | GET | `/api/Users/me` | Current user's claims (`CurrentUserDto`) | Yes |
| Projects | GET | `/api/Projects` | List the current user's projects | Yes |
| Projects | GET | `/api/Projects/{id}` | Fetch one project | Yes |
| Projects | POST | `/api/Projects` | Create a project (active-account gate; no project cap) | Yes |
| Projects | POST | `/api/Projects/import` | Import a project from an external source | Yes |
| Projects | PUT | `/api/Projects/{id}` | Update a project | Yes |
| Projects | DELETE | `/api/Projects/{id}` | Delete a project | Yes |
| Projects | GET | `/api/Projects/{id}/assessment` | Fetch the assessment (404 if none) | Yes |
| Projects | PUT | `/api/Projects/{id}/assessment` | Save assessment input + result + scores | Yes |
| Projects | POST | `/api/Projects/{id}/report` | Generate PDF; returns a presigned download URL | Yes |
| Subscriptions | GET | `/api/Subscriptions/me` | Current user's subscription (plan, used count) | Yes |
| Admin | GET | `/api/Admin/users` | List all users with subscription info | Admin |
| Admin | GET | `/api/Admin/users/{id}` | Fetch one user (404 if missing) | Admin |
| Admin | POST | `/api/Admin/users` | Create a user | Admin |
| Admin | PUT | `/api/Admin/users/{id}/subscription` | Update a user's plan / active status | Admin |
| Admin | PUT | `/api/Admin/users/{id}/role` | Grant/revoke the Administrator role | Admin |
| Admin | DELETE | `/api/Admin/users/{id}` | Delete a user | Admin |

---

## Authentication (external IdP — no API endpoints)

Authentication is **OAuth2 / OIDC via the external IdP** (OpenIddict at `https://<AUTH_DOMAIN>`). All login methods (password, OTP, Google, …) live in the IdP, which is the sole token issuer. The API has **no** sign-in, registration, refresh, or logout endpoints; it only **validates** the IdP's signed JWTs (`AddJwtBearer`, JWKS-verified) and reads claims. Clients get a token from the IdP and send `Authorization: Bearer <jwt>`.

## Users

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/Users/me` | Current user's claims, read from the validated OIDC JWT. | Yes |

`CurrentUserDto`: `{ id (the `sub` claim), email, phoneNumber, roles: string[] (the `role` claim), isAdmin: boolean (derived) }`.

## Projects

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/Projects` | List the current user's projects. | Yes |
| GET | `/api/Projects/{id}` | Fetch one project. | Yes |
| POST | `/api/Projects` | Create a project. Runs `EnsureCanCreateProjectAsync` (active-account gate; no project cap). | Yes |
| POST | `/api/Projects/import` | Import from an external registry (`<EXTERNAL_SOURCE>`). | Yes |
| PUT | `/api/Projects/{id}` | Update a project. | Yes |
| DELETE | `/api/Projects/{id}` | Delete a project. | Yes |
| GET | `/api/Projects/{id}/assessment` | Fetch the assessment, or 404. | Yes |
| PUT | `/api/Projects/{id}/assessment` | Save `inputJson` + `resultJson` + `totalScore` + `maxScore`. | Yes |
| POST | `/api/Projects/{id}/report` | Render the PDF, store it in MinIO, return a presigned URL (valid ~1 hour). | Yes |

> Gate: an **inactive account** blocks create/import with a `ValidationException` surfaced under the `Subscription` field (`400`). The per-user **project cap is not enforced** (ADR-020) — to re-enable a cap, see `subscriptions.md` §5.

## Subscriptions

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/Subscriptions/me` | Current user's subscription: plan, `maxProjects` (display-only, not enforced), used count. | Yes |

## Admin (Administrator role only)

| Method | Path | Purpose | Auth |
|--------|------|---------|------|
| GET | `/api/Admin/users` | List all users with subscription info. | Admin |
| GET | `/api/Admin/users/{id}` | Fetch one user (404 if missing). | Admin |
| POST | `/api/Admin/users` | Create a user. | Admin |
| PUT | `/api/Admin/users/{id}/subscription` | Update a user's plan / active status. | Admin |
| PUT | `/api/Admin/users/{id}/role` | Grant/revoke the Administrator role. | Admin |
| DELETE | `/api/Admin/users/{id}` | Delete a user. | Admin |

---

## Adapting this to your project

1. **Rename the domain group.** `Projects` is the reference project's main resource. If yours is `<MainResource>`, the class `<MainResource>` in `src/Web/Endpoints` auto-maps to `/api/<MainResource>` — change the group name and its row paths accordingly.
2. **Keep the cross-cutting groups as-is** unless you change the feature: `Users` (just `GET /me`, reading OIDC claims — sign-in lives in the external IdP, not the API), `Subscriptions` (read-only plan), `Admin` (user/plan management). These are part of the blueprint.
3. **Nested resources** (like `/api/Projects/{id}/assessment` and `/.../report`) hang off the parent group — name them after your sub-resource and its action.
4. **Auth column rule of thumb:** the API has no anonymous endpoints (sign-in is the IdP's job); everything user-scoped = **Yes** (valid OIDC JWT); everything under `/api/Admin/*` = **Admin**.
5. **Add a request/response shape** in prose under each group where the body matters (see `CurrentUserDto` above). Don't duplicate the full Scalar schema — link to `/scalar`.

> *Worked example values above (`/api/Projects`, `CurrentUserDto`, active-account validation, presigned report URL) are the reference project **Mabhas19**.*
