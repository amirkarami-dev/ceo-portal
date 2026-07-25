# Auth & Roles

> # ⛔ SUPERSEDED for production by central OIDC SSO (ADR-013) — see [`sso-oidc.md`](sso-oidc.md).
> **Retained as the historical single-service bearer-token reference.**
>
> In production, **`src/Web` is now a JWT resource server** that validates IdP-issued OIDC
> tokens via `AddJwtBearer` — it has **no `MapIdentityApi`** and **no `/api/Auth/*` (OTP /
> Google) endpoints**; those moved to the IdP (`src/Auth`). Everything below describes the
> *original* single-service bearer-token model (`MapIdentityApi` + `AddBearerToken`), kept as
> a historical reference for a standalone deployment that does not need SSO.
>
> **For the production `*.myceo.ir` architecture** (mabhas19 + plan + future services sharing
> one login), the authoritative model is the **OIDC/SSO central IdP** described in
> [`sso-oidc.md`](sso-oidc.md) (Token Contract frozen 2026-06-03, **deployed to production**)
> and recorded in **ADR-013** (`plan_development/00-planning/architecture-decisions.md`). The
> web client's server-side auth boundary is further refined by **ADR-017**.
>
> **What changed:**
> - `src/Auth` (OpenIddict) is now the only component that authenticates users. It owns
>   `Mabhas19AuthDb` and all login UI (password, OTP, Google).
> - `src/Web` is a **resource server**: it validates IdP JWTs via `AddJwtBearer` and reads
>   identity from `sub`/`role` claims. `MapIdentityApi` and `Web/Endpoints/Auth.cs` are
>   removed.
> - Web clients use **Auth.js (NextAuth v5)** OIDC + httpOnly cookies instead of
>   `localStorage` bearer tokens. Mobile uses `expo-auth-session` code+PKCE.
> - `Mabhas19Db`'s `AspNetUsers` rows are migrated to `Mabhas19AuthDb` with IDs preserved
>   (see `deploy/sso-migrate-users.sql`). `Project.OwnerId` / `Subscription.UserId`
>   references remain valid with no schema changes to `Mabhas19Db`.
> - ADR-006 (`MapIdentityApi`) is marked *Superseded by ADR-013*.

`<PLACEHOLDER>` uses **ASP.NET Identity bearer tokens** with three sign-in methods, and a
simple two-role model (`Administrator` / `User`). All three sign-ins issue the **same**
bearer access/refresh tokens, so the rest of the system treats every authenticated user
identically.

---

## 1. Identity setup (Infrastructure)

`Infrastructure/DependencyInjection.cs` wires Identity with the bearer scheme and EF stores:

```csharp
builder.Services.AddAuthentication()
    .AddBearerToken(IdentityConstants.BearerScheme);

builder.Services.AddAuthorizationBuilder();

builder.Services
    .AddIdentityCore<ApplicationUser>()
    .AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>()
    .AddApiEndpoints();            // exposes the Identity API (register/login/refresh/...)
```

The Identity API endpoints are mounted under **`/api/Users/*`** by the `Users` endpoint
group:

```csharp
public class Users : IEndpointGroup            // → /api/Users
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapIdentityApi<ApplicationUser>();        // register, login, refresh, ...
        groupBuilder.MapGet(Me, "me").RequireAuthorization();
        groupBuilder.MapPost(Logout, "logout").RequireAuthorization();
    }
}
```

So username/password sign-in is **`POST /api/Users/login`** → returns `{ accessToken,
refreshToken, expiresIn }`; refresh is **`POST /api/Users/refresh`**.

---

## 2. The three sign-in methods

All three return Identity bearer tokens. Clients store them (web: `localStorage`; mobile:
`expo-secure-store`) and send `Authorization: Bearer <access>` on every request.

| Method | Endpoint | Notes |
|---|---|---|
| Username / password | `POST /api/Users/login` (Identity API) | Standard `MapIdentityApi`. |
| Mobile OTP | `POST /api/Auth/otp/request`, `POST /api/Auth/otp/verify` | SMS code; creates the user on first verify. See `sms-otp.md`. |
| Google ID token | `POST /api/Auth/google` | Validates a Google `idToken`; creates the user if new. |

### How OTP / Google issue a bearer token (the key trick)
These flows are **not** the Identity login endpoint, so they cannot return tokens directly.
Instead they sign in **with the bearer scheme**, which makes Identity emit the same token
response. The pattern (in `Web/Endpoints/Auth.cs`):

```csharp
// after verifying the OTP / Google token and finding-or-creating the user:
signInManager.AuthenticationScheme = IdentityConstants.BearerScheme;
await signInManager.SignInAsync(user, isPersistent: false);
return Results.Empty;     // Identity writes the bearer token to the response
```

OTP verify and Google login both find-or-create the `ApplicationUser` first:
- **OTP**: look up by `PhoneNumber`; if none, create one with `PhoneNumberConfirmed = true`.
- **Google**: validate the token (`IGoogleTokenValidator`, audience = configured
  `Authentication:Google:ClientId`), look up by email; if none, create with
  `EmailConfirmed = info.EmailVerified`.

The `Auth` group is **not** behind `RequireAuthorization` (these are the ways you *get*
authenticated).

---

## 3. Roles

Two roles, defined as constants in `Domain/Constants/Roles.cs`:

```csharp
public abstract class Roles
{
    public const string Administrator = nameof(Administrator);   // manage users + subscriptions
    public const string User = nameof(User);                     // default registered user
    public static readonly string[] All = { Administrator, User };
}
```

Both roles are seeded on startup, and an admin account is created from config, by
`ApplicationDbContextInitialiser.TrySeedAsync()`:

- Ensures every role in `Roles.All` exists.
- Reads `AdminUser:Email` / `AdminUser:Password` from config (env vars in prod,
  `appsettings.Development.json` locally). **If they are not set it skips seeding** rather
  than ship a default password.
- Creates the admin user, adds them to `Administrator`, and gives them an unrestricted
  Enterprise subscription (see `subscriptions.md`).

---

## 4. Gating endpoints by role

Two layers, both used in this project:

**a. Route-level (Web).** Require any authenticated user, or a specific role, on the group:

```csharp
// any signed-in user (Projects, Subscriptions groups)
groupBuilder.RequireAuthorization();

// admin-only (Admin group → all /api/Admin/* require the Administrator role)
groupBuilder.RequireAuthorization(policy => policy.RequireRole(Roles.Administrator));
```

**b. Request-level (Application).** Put `[Authorize]` on a command/query; the MediatR
`AuthorizationBehaviour` enforces it (authenticated check, plus `Roles`/`Policy` if set —
throwing `UnauthorizedAccessException` → 401 or `ForbiddenAccessException` → 403). Resource
ownership is checked inside handlers:

```csharp
if (project.OwnerId != _user.Id) throw new ForbiddenAccessException();   // 403
```

Use route-level for coarse gating, `[Authorize]` for use-case gating, and explicit owner
checks for per-resource access.

---

## 5. `GET /api/Users/me` (who am I + roles)

The frontend learns the current user and admin status from this endpoint:

```csharp
public static async Task<Results<Ok<CurrentUserDto>, UnauthorizedHttpResult>> Me(
    IUser user, UserManager<ApplicationUser> userManager)
{
    if (string.IsNullOrEmpty(user.Id)) return TypedResults.Unauthorized();
    var appUser = await userManager.FindByIdAsync(user.Id);
    if (appUser is null) return TypedResults.Unauthorized();

    var roles = await userManager.GetRolesAsync(appUser);
    return TypedResults.Ok(new CurrentUserDto(
        appUser.Id, appUser.Email, appUser.PhoneNumber,
        roles.ToArray(), roles.Contains(Roles.Administrator)));   // → { ..., roles, isAdmin }
}

public record CurrentUserDto(string Id, string? Email, string? PhoneNumber, string[] Roles, bool IsAdmin);
```

The current user id comes from `IUser` (`Application/Common/Interfaces/IUser.cs`),
implemented in Web by `CurrentUser` reading the `HttpContext` principal.

---

## 6. The client side (web & mobile)

Both clients share the same shape:

1. A call into `authApi` (`endpoints.ts`) — `login` / `verifyOtp` / `google` — returns the
   token response.
2. Tokens are saved (`saveTokens` → `tokenStore`): web in `localStorage`, mobile in
   `expo-secure-store` (with a sync in-memory cache).
3. `apiFetch` attaches the bearer and **auto-refreshes once on 401** via
   `/api/Users/refresh`.
4. `AuthProvider` calls `GET /api/Users/me` to populate `useAuth()` → `{ user, isAdmin,
   ... }`.
5. UI gates: render protected routes inside `<RequireAuth>` (web) / check `loading` +
   redirect (mobile); show admin UI only when `useAuth().isAdmin`.

Mobile `auth-context.tsx` exposes the three sign-ins directly:

```ts
const loginWithPassword = (email, password) => authApi.login(...).then(saveTokens).then(refreshUser)
const loginWithOtp      = (phone, code)     => authApi.verifyOtp(...).then(saveTokens).then(refreshUser)
const loginWithGoogle   = (idToken)         => authApi.google(...).then(saveTokens).then(refreshUser)
```

See `frontend-web.md` / `mobile-expo.md` for the lib-layer details, `sms-otp.md` for the
OTP backend, and `subscriptions.md` for the subscription account-gate on project creation.
