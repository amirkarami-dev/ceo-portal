# SSO Phase 1 — Central IdP + API Resource Server (foundation)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the `auth.myceo.ir` OpenIddict Identity Provider (`src/Auth`) and convert the `mabhas19` API (`src/Web`) into a JWT resource server, then verify the end-to-end token contract — freezing it for Phases 2–3.

**Architecture:** A new ASP.NET 10 project `src/Auth` runs OpenIddict (authorization-code + PKCE, refresh) over ASP.NET Identity backed by its own SQL database `Mabhas19AuthDb`. It issues **signed (unencrypted) JWT** access tokens validated by any resource server via JWKS. `src/Web` drops its local login (`MapIdentityApi`, OTP, Google) and validates those JWTs with `AddJwtBearer`. The login methods (password/OTP/Google) move into the IdP's Razor login UI.

**Tech Stack:** .NET 10, OpenIddict 6.x, ASP.NET Identity, EF Core 10 (SQL Server), Razor Pages (IdP login UI), NUnit + `Microsoft.AspNetCore.Mvc.Testing`.

**Reference:** Contract is `plan_development/01-development/sso-oidc.md` §4. This plan implements §5 components A and B and §8 Phase 1.

---

## File structure (Phase 1)

**Create — `src/Auth/` (component A):**
- `Auth.csproj` — project + package refs
- `Program.cs` — host, Identity, OpenIddict server+validation, pipeline
- `Data/AuthDbContext.cs` — `IdentityDbContext<AuthUser>` + `UseOpenIddict()`
- `Data/AuthUser.cs` — `IdentityUser` (mirrors `ApplicationUser`)
- `Data/AuthDbInitialiser.cs` — migrate + seed roles/clients/scopes/dev-admin
- `Data/Migrations/*` — EF migration `InitialAuth`
- `Auth/AuthorizationController.cs` — `/connect/authorize|token|userinfo|logout` + claim destinations
- `Auth/ClaimsPrincipalFactoryExtensions.cs` — build principal + claim destinations per contract
- `Otp/OtpService.cs`, `Otp/OtpOptions.cs`, `Sms/SmsSender.cs`, `Sms/SmsOptions.cs` — moved from `src/Infrastructure`
- `External/GoogleTokenValidator.cs`, `External/GoogleAuthOptions.cs` — moved from `src/Infrastructure`
- `Pages/Account/Login.cshtml(.cs)` — password + OTP + "Continue with Google" (RTL)
- `Pages/Account/Logout.cshtml.cs`, `Pages/_ViewImports.cshtml`, `Pages/Shared/_Layout.cshtml`
- `appsettings.json`, `appsettings.Development.json`, `Properties/launchSettings.json` (port 5100)

**Modify — `src/Web/` (component B):**
- `src/Web/DependencyInjection.cs` — (no change here; auth wiring is in Infrastructure)
- `src/Infrastructure/DependencyInjection.cs` — replace `AddBearerToken`+`AddIdentityCore().AddApiEndpoints()` with `AddJwtBearer`; drop moved services (OTP/SMS/Google)
- `src/Web/Program.cs` — `UseAuthentication()` before `UseAuthorization()`; keep pipeline
- `src/Web/Endpoints/Auth.cs` — **delete** (OTP/Google moved to IdP)
- `src/Web/Endpoints/Users.cs` — remove `MapIdentityApi` mount; keep `GET /api/Users/me` (reads JWT claims)
- `src/Web/Services/CurrentUser.cs` — read `sub`/`role` from JWT (verify)

**Shared config:**
- `Directory.Packages.props` — add OpenIddict packages
- `Mabhas19.slnx` — add `src/Auth`

**Tests:**
- `tests/Auth.FunctionalTests/` — token issuance + claims (new project)
- `tests/Application.FunctionalTests/Auth/JwtResourceServerTests.cs` — API accepts IdP JWT / rejects others (the **contract-freeze gate**)

---

## Task A1: Scaffold `src/Auth` project + packages

**Files:**
- Create: `src/Auth/Auth.csproj`, `src/Auth/Program.cs` (stub)
- Modify: `Directory.Packages.props`, `Mabhas19.slnx`

- [ ] **Step 1: Add package versions** to `Directory.Packages.props` `<ItemGroup>`:

```xml
<PackageVersion Include="OpenIddict.AspNetCore" Version="6.0.0" />
<PackageVersion Include="OpenIddict.EntityFrameworkCore" Version="6.0.0" />
```
(Use the latest 6.x that targets .NET 10; pin the resolved version.)

- [ ] **Step 2: Create `src/Auth/Auth.csproj`:**

```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <Nullable>enable</Nullable>
    <ImplicitUsings>enable</ImplicitUsings>
    <RootNamespace>Mabhas19.Auth</RootNamespace>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Identity.EntityFrameworkCore" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.SqlServer" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.Design" />
    <PackageReference Include="OpenIddict.AspNetCore" />
    <PackageReference Include="OpenIddict.EntityFrameworkCore" />
    <PackageReference Include="Google.Apis.Auth" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\ServiceDefaults\ServiceDefaults.csproj" />
  </ItemGroup>
</Project>
```

- [ ] **Step 3: Stub `src/Auth/Program.cs`:**

```csharp
var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults();
var app = builder.Build();
app.MapDefaultEndpoints();
app.MapGet("/", () => "Mabhas19 Auth");
app.Run();
public partial class Program;
```

- [ ] **Step 4: Add project to solution.** Run: `dotnet sln Mabhas19.slnx add src/Auth/Auth.csproj`
- [ ] **Step 5: Build.** Run: `dotnet build src/Auth/Auth.csproj` → Expected: PASS (0 errors).
- [ ] **Step 6: Commit.**
```bash
git add src/Auth Directory.Packages.props Mabhas19.slnx
git commit -m "feat(auth): scaffold src/Auth IdP project"
```

---

## Task A2: AuthUser + AuthDbContext + initial migration

**Files:**
- Create: `src/Auth/Data/AuthUser.cs`, `src/Auth/Data/AuthDbContext.cs`
- Modify: `src/Auth/Program.cs`, `src/Auth/appsettings.Development.json`

- [ ] **Step 1: `src/Auth/Data/AuthUser.cs`:**
```csharp
using Microsoft.AspNetCore.Identity;
namespace Mabhas19.Auth.Data;
// Mirrors src/Infrastructure ApplicationUser so migrated rows map 1:1.
public class AuthUser : IdentityUser;
```

- [ ] **Step 2: `src/Auth/Data/AuthDbContext.cs`:**
```csharp
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
namespace Mabhas19.Auth.Data;
public class AuthDbContext(DbContextOptions<AuthDbContext> options) : IdentityDbContext<AuthUser>(options)
{
    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.UseOpenIddict(); // OpenIddict apps/scopes/tokens/authorizations tables
    }
}
```

- [ ] **Step 3: Register DbContext + Identity in `Program.cs`** (before `Build()`):
```csharp
builder.Services.AddDbContext<AuthDbContext>(o =>
{
    o.UseSqlServer(builder.Configuration.GetConnectionString("Mabhas19AuthDb"));
    o.UseOpenIddict();
});
builder.Services.AddIdentity<AuthUser, IdentityRole>()
    .AddEntityFrameworkStores<AuthDbContext>()
    .AddDefaultTokenProviders();
```

- [ ] **Step 4: Dev connection string** in `src/Auth/appsettings.Development.json`:
```json
{ "ConnectionStrings": { "Mabhas19AuthDb": "Server=127.0.0.1,1433;Database=Mabhas19AuthDb;User Id=sa;Password=Mabhas19_Sql#2026;TrustServerCertificate=True;" } }
```

- [ ] **Step 5: Create the migration.** Run:
```
dotnet ef migrations add InitialAuth --project src/Auth --startup-project src/Auth --output-dir Data/Migrations
```
Expected: scaffolds `Data/Migrations/*_InitialAuth.cs` with Identity + OpenIddict tables. (`dotnet-ef` must be 10.0.*.)

- [ ] **Step 6: Build.** Run: `dotnet build src/Auth/Auth.csproj` → PASS.
- [ ] **Step 7: Commit.**
```bash
git add src/Auth
git commit -m "feat(auth): AuthDbContext (Identity + OpenIddict) + InitialAuth migration"
```

---

## Task A3: OpenIddict server + validation configuration

**Files:** Modify `src/Auth/Program.cs`

- [ ] **Step 1: Add the OpenIddict registration** (after Identity, before `Build()`):
```csharp
builder.Services.AddOpenIddict()
    .AddCore(o => o.UseEntityFrameworkCore().UseDbContext<AuthDbContext>())
    .AddServer(o =>
    {
        o.SetAuthorizationEndpointUris("connect/authorize")
         .SetTokenEndpointUris("connect/token")
         .SetUserInfoEndpointUris("connect/userinfo")
         .SetEndSessionEndpointUris("connect/logout");

        o.AllowAuthorizationCodeFlow().RequireProofKeyForCodeExchange()
         .AllowRefreshTokenFlow();

        o.RegisterScopes("openid", "profile", "email", "roles", "offline_access", "mabhas19.api", "plan.api");

        o.SetAccessTokenLifetime(TimeSpan.FromMinutes(30));
        o.SetRefreshTokenLifetime(TimeSpan.FromDays(14));

        // Signed (NOT encrypted) JWT so resource servers validate via JWKS with AddJwtBearer.
        o.DisableAccessTokenEncryption();

        if (builder.Environment.IsDevelopment())
        {
            o.AddDevelopmentEncryptionCertificate().AddDevelopmentSigningCertificate();
        }
        else
        {
            // Persisted signing cert (mounted in prod). Encryption cert optional since access tokens are unencrypted.
            var certPath = builder.Configuration["OpenIddict:SigningCertificatePath"]!;
            var certPwd = builder.Configuration["OpenIddict:SigningCertificatePassword"];
            o.AddSigningCertificate(new X509Certificate2(certPath, certPwd));
            o.AddEncryptionCertificate(new X509Certificate2(certPath, certPwd));
        }

        o.UseAspNetCore()
         .EnableAuthorizationEndpointPassthrough()
         .EnableTokenEndpointPassthrough()
         .EnableUserInfoEndpointPassthrough()
         .EnableEndSessionEndpointPassthrough();
    })
    .AddValidation(o => { o.UseLocalServer(); o.UseAspNetCore(); });
```
(Add `using System.Security.Cryptography.X509Certificates;`.)

- [ ] **Step 2: Pipeline** — ensure in `Program.cs` after `Build()`:
```csharp
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapRazorPages();
```
Add `builder.Services.AddControllersWithViews(); builder.Services.AddRazorPages();` before `Build()`.

- [ ] **Step 3: Build.** Run: `dotnet build src/Auth/Auth.csproj` → PASS.
- [ ] **Step 4: Commit.**
```bash
git add src/Auth/Program.cs
git commit -m "feat(auth): OpenIddict server (code+PKCE, refresh, signed JWT) + validation"
```

---

## Task A4: Claim destinations factory (defines the token contract)

**Files:** Create `src/Auth/Auth/OpenIddictClaimDestinations.cs`

- [ ] **Step 1: Implement the destinations mapper** (which claims land in access vs id token, per contract §4):
```csharp
using System.Security.Claims;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;
namespace Mabhas19.Auth;

public static class OpenIddictClaimDestinations
{
    public static IEnumerable<string> For(Claim claim) => claim.Type switch
    {
        Claims.Name or "name"        => [Destinations.AccessToken, Destinations.IdentityToken],
        Claims.Email or "email"      => [Destinations.AccessToken, Destinations.IdentityToken],
        Claims.Role or "role"        => [Destinations.AccessToken, Destinations.IdentityToken],
        "preferred_username"          => [Destinations.AccessToken, Destinations.IdentityToken],
        _ => [Destinations.AccessToken]
    };
}
```

- [ ] **Step 2: Build.** Run: `dotnet build src/Auth/Auth.csproj` → PASS.
- [ ] **Step 3: Commit.**
```bash
git add src/Auth/Auth/OpenIddictClaimDestinations.cs
git commit -m "feat(auth): claim-destination mapping per token contract"
```

---

## Task A5: AuthorizationController (authorize / token / userinfo / logout)

**Files:** Create `src/Auth/Auth/AuthorizationController.cs`

- [ ] **Step 1: Implement the controller.** Authorize requires an authenticated cookie session (else challenge to the login page); token endpoint issues claims with destinations; refresh re-issues. Build a `ClaimsPrincipal` carrying `sub` (user id), `name`, `email`, `role` (from Identity), scoped to the requested scopes; set `principal.SetDestinations(OpenIddictClaimDestinations.For)`.
```csharp
using System.Security.Claims;
using Mabhas19.Auth.Data;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;
using static OpenIddict.Abstractions.OpenIddictConstants;
namespace Mabhas19.Auth;

public class AuthorizationController(
    SignInManager<AuthUser> signInManager,
    UserManager<AuthUser> userManager) : Controller
{
    [HttpGet("connect/authorize"), HttpPost("connect/authorize")]
    public async Task<IActionResult> Authorize()
    {
        var request = HttpContext.GetOpenIddictServerRequest()!;
        var result = await HttpContext.AuthenticateAsync(IdentityConstants.ApplicationScheme);
        if (!result.Succeeded)
        {
            return Challenge(
                authenticationSchemes: IdentityConstants.ApplicationScheme,
                properties: new AuthenticationProperties
                {
                    RedirectUri = Request.PathBase + Request.Path + QueryString.Create(Request.HasFormContentType ? Request.Form : Request.Query)
                });
        }

        var user = await userManager.GetUserAsync(result.Principal)
                   ?? throw new InvalidOperationException("User not found.");

        var principal = await BuildPrincipalAsync(user, request.GetScopes());
        return SignIn(principal, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }

    [HttpPost("connect/token"), Produces("application/json")]
    public async Task<IActionResult> Exchange()
    {
        var request = HttpContext.GetOpenIddictServerRequest()!;
        if (!request.IsAuthorizationCodeGrantType() && !request.IsRefreshTokenGrantType())
            throw new InvalidOperationException("Unsupported grant type.");

        var auth = await HttpContext.AuthenticateAsync(OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
        var user = await userManager.GetUserAsync(auth.Principal!)
                   ?? throw new InvalidOperationException("User not found.");

        var principal = await BuildPrincipalAsync(user, auth.Principal!.GetScopes());
        return SignIn(principal, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }

    [HttpGet("connect/userinfo")]
    public async Task<IActionResult> UserInfo()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null) return Challenge(OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
        return Ok(new Dictionary<string, object?>
        {
            [Claims.Subject] = user.Id,
            [Claims.Name] = user.UserName,
            [Claims.Email] = user.Email
        });
    }

    [HttpGet("connect/logout"), HttpPost("connect/logout")]
    public async Task<IActionResult> Logout()
    {
        await signInManager.SignOutAsync();
        return SignOut(authenticationSchemes: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            properties: new AuthenticationProperties { RedirectUri = "/" });
    }

    private async Task<ClaimsPrincipal> BuildPrincipalAsync(AuthUser user, IEnumerable<string> scopes)
    {
        var principal = await signInManager.CreateUserPrincipalAsync(user);
        principal.SetClaim(Claims.Subject, user.Id);
        principal.SetClaim(Claims.Name, user.UserName);
        principal.SetClaim(Claims.Email, user.Email);
        principal.SetClaim("preferred_username", user.UserName);
        principal.SetClaims(Claims.Role, [.. await userManager.GetRolesAsync(user)]);
        principal.SetScopes(scopes);
        principal.SetResources("mabhas19.api"); // audience
        principal.SetDestinations(OpenIddictClaimDestinations.For);
        return principal;
    }
}
```

- [ ] **Step 2: Build.** Run: `dotnet build src/Auth/Auth.csproj` → PASS.
- [ ] **Step 3: Commit.**
```bash
git add src/Auth/Auth/AuthorizationController.cs
git commit -m "feat(auth): authorize/token/userinfo/logout endpoints with contract claims"
```

---

## Task A6: Login UI (password) — Razor Pages

**Files:** Create `src/Auth/Pages/Account/Login.cshtml`, `Login.cshtml.cs`, `Pages/Shared/_Layout.cshtml`, `Pages/_ViewImports.cshtml`, `Pages/_ViewStart.cshtml`

- [ ] **Step 1: `Login.cshtml.cs`** — GET shows form; POST signs in via `SignInManager.PasswordSignInAsync`, then redirects to `ReturnUrl` (the authorize URL):
```csharp
using Mabhas19.Auth.Data;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;
namespace Mabhas19.Auth.Pages.Account;

public class LoginModel(SignInManager<AuthUser> signInManager) : PageModel
{
    [BindProperty] public string UserName { get; set; } = "";
    [BindProperty] public string Password { get; set; } = "";
    public string? ReturnUrl { get; set; }
    public string? Error { get; set; }

    public void OnGet(string? returnUrl) => ReturnUrl = returnUrl ?? "/";

    public async Task<IActionResult> OnPostAsync(string? returnUrl)
    {
        var result = await signInManager.PasswordSignInAsync(UserName, Password, isPersistent: true, lockoutOnFailure: true);
        if (!result.Succeeded) { Error = "نام کاربری یا گذرواژه نادرست است."; ReturnUrl = returnUrl ?? "/"; return Page(); }
        return LocalRedirect(returnUrl ?? "/");
    }
}
```

- [ ] **Step 2: `Login.cshtml`** — minimal RTL Persian form posting `UserName`/`Password` with the hidden `ReturnUrl`, an OTP link, and a "Continue with Google" form (added in A8). Use `<html dir="rtl" lang="fa">` in `_Layout.cshtml`.

- [ ] **Step 3: Build + manual smoke** (deferred to A9 once a user is seeded). Build: `dotnet build src/Auth/Auth.csproj` → PASS.
- [ ] **Step 4: Commit.**
```bash
git add src/Auth/Pages
git commit -m "feat(auth): Razor password login UI (RTL)"
```

---

## Task A7: Move OTP login into the IdP

**Files:**
- Move (git mv from `src/Infrastructure/Auth/`): `OtpService.cs`, `OtpOptions.cs`, `Sms/SmsSender.cs`, `Sms/SmsOptions.cs` → `src/Auth/Otp/`, `src/Auth/Sms/` (renamespace to `Mabhas19.Auth.*`); keep the throttle logic intact.
- Create: `src/Auth/Pages/Account/Otp.cshtml(.cs)`
- Modify: `src/Auth/Program.cs` (register `IDistributedMemoryCache`, `OtpOptions`, `SmsOptions`, `OtpService`, `HttpClient<SmsSender>`)

- [ ] **Step 1: Move files + fix namespaces.** Define a local `IOtpService`/`ISmsSender` interface inside `src/Auth` (the IdP no longer references `src/Application`). Preserve `RequestAsync`/`VerifyAsync` and all throttle options.
- [ ] **Step 2: `Otp.cshtml.cs`** — request code (`OtpService.RequestAsync(phone)`); verify (`VerifyAsync`); on success find-or-create the `AuthUser` by phone, `SignInManager.SignInAsync`, redirect to `ReturnUrl`.
- [ ] **Step 3: Register services** in `Program.cs`:
```csharp
builder.Services.AddDistributedMemoryCache();
builder.Services.Configure<OtpOptions>(builder.Configuration.GetSection(OtpOptions.SectionName));
builder.Services.Configure<SmsOptions>(builder.Configuration.GetSection(SmsOptions.SectionName));
builder.Services.AddScoped<IOtpService, OtpService>();
builder.Services.AddHttpClient<ISmsSender, SmsSender>();
```
- [ ] **Step 4: Build.** `dotnet build src/Auth/Auth.csproj` → PASS.
- [ ] **Step 5: Commit.**
```bash
git add -A src/Auth src/Infrastructure
git commit -m "feat(auth): move OTP/SMS login into the IdP"
```

---

## Task A8: Move Google login into the IdP

**Files:**
- Move: `src/Infrastructure/Auth/GoogleTokenValidator.cs`, `GoogleAuthOptions` → `src/Auth/External/` (renamespace)
- Modify: `Program.cs` (register), `Pages/Account/Login.cshtml(.cs)` (Google handler)

- [ ] **Step 1: Move + renamespace** the Google validator; define a local `IGoogleTokenValidator`.
- [ ] **Step 2: Google sign-in handler** — `Login.cshtml.cs` `OnPostGoogleAsync(string idToken, string? returnUrl)`: validate the Google ID token, find-or-create `AuthUser` by email, `SignInManager.SignInAsync`, `LocalRedirect(returnUrl)`.
- [ ] **Step 3: Register** `IGoogleTokenValidator` + `Configure<GoogleAuthOptions>` in `Program.cs`.
- [ ] **Step 4: Build.** PASS.
- [ ] **Step 5: Commit.**
```bash
git add -A src/Auth src/Infrastructure
git commit -m "feat(auth): move Google login into the IdP"
```

---

## Task A9: Seed roles, OIDC clients/scopes, dev admin

**Files:** Create `src/Auth/Data/AuthDbInitialiser.cs`; modify `Program.cs`

- [ ] **Step 1: Initialiser** — on startup: `MigrateAsync()`; ensure roles `Administrator`/`User`; register scopes (`mabhas19.api` resource = `mabhas19.api`); register the three clients per contract §4 using `IOpenIddictApplicationManager`:
```csharp
// mabhas19-web (confidential, code+PKCE+refresh)
await appManager.CreateAsync(new OpenIddictApplicationDescriptor
{
    ClientId = "mabhas19-web",
    ClientSecret = config["Clients:Mabhas19Web:Secret"],
    ClientType = ClientTypes.Confidential,
    RedirectUris = { new Uri(config["Clients:Mabhas19Web:Redirect"]!) },
    PostLogoutRedirectUris = { new Uri(config["Clients:Mabhas19Web:PostLogout"]!) },
    Permissions =
    {
        Permissions.Endpoints.Authorization, Permissions.Endpoints.Token, Permissions.Endpoints.EndSession,
        Permissions.GrantTypes.AuthorizationCode, Permissions.GrantTypes.RefreshToken,
        Permissions.ResponseTypes.Code,
        Permissions.Scopes.Email, Permissions.Scopes.Profile, Permissions.Scopes.Roles,
        Permissions.Prefixes.Scope + "mabhas19.api"
    },
    Requirements = { Requirements.Features.ProofKeyForCodeExchange }
});
// mabhas19-mobile (public, PKCE, custom-scheme redirect) — ClientType=Public, no secret, redirect "mabhas19://auth"
// plan-web (confidential placeholder) — same shape, scope "plan.api", redirect plan.myceo.ir
```
Seed a dev admin (`AdminUser:Email`/`Password`) only when configured (mirror the existing initialiser's skip-if-unconfigured behaviour).

- [ ] **Step 2: Call `await app.Services.InitialiseAuthAsync();`** in `Program.cs` after `Build()`.
- [ ] **Step 3: Run the IdP** against local SQL: `dotnet run --project src/Auth` (dev port 5100). Verify `http://localhost:5100/.well-known/openid-configuration` returns the discovery doc and lists the endpoints + `mabhas19.api` scope. Expected: HTTP 200 JSON.
- [ ] **Step 4: Commit.**
```bash
git add src/Auth
git commit -m "feat(auth): seed roles, OIDC clients/scopes, dev admin"
```

---

## Task A10: IdP functional test — token issuance + claims

**Files:** Create `tests/Auth.FunctionalTests/Auth.FunctionalTests.csproj`, `TokenIssuanceTests.cs`; add to `Mabhas19.slnx`

- [ ] **Step 1: Test project** referencing `src/Auth`, `Microsoft.AspNetCore.Mvc.Testing`, NUnit, Shouldly. Use `WebApplicationFactory<Program>` with a SQL test DB (reuse the Aspire/Testcontainers pattern from `Application.FunctionalTests`, or a dedicated test DB).

- [ ] **Step 2: Failing test** — password grant via the OIDC flow is hard to script headlessly; instead test the **resource-owner-style integration through the token endpoint using a seeded test user + the authorization-code flow simulated** OR assert discovery + JWKS + scope registration first:
```csharp
[Test]
public async Task Discovery_exposes_endpoints_and_api_scope()
{
    var doc = await _client.GetFromJsonAsync<JsonElement>("/.well-known/openid-configuration");
    doc.GetProperty("issuer").GetString().ShouldNotBeNullOrEmpty();
    doc.GetProperty("token_endpoint").GetString().ShouldContain("connect/token");
    doc.GetProperty("scopes_supported").EnumerateArray()
       .Select(s => s.GetString()).ShouldContain("mabhas19.api");
}
```
- [ ] **Step 3: Run → fail (project not wired), then pass.** Run: `dotnet test tests/Auth.FunctionalTests/Auth.FunctionalTests.csproj`.
- [ ] **Step 4: Claims test** — issue a token for a seeded user via the code flow helper and assert the **decoded JWT** has `aud=mabhas19.api`, `sub`, `role`, and is **not encrypted** (parseable as a JWT). (Helper drives `/connect/authorize` with a test cookie + `/connect/token`.)
- [ ] **Step 5: Commit.**
```bash
git add tests/Auth.FunctionalTests Mabhas19.slnx
git commit -m "test(auth): discovery + token claims (contract) functional tests"
```

---

## Task B1: API → JWT resource server

**Files:** Modify `src/Infrastructure/DependencyInjection.cs`, `src/Web/Program.cs`

- [ ] **Step 1: Replace the auth registration** in `src/Infrastructure/DependencyInjection.cs`. Remove:
```csharp
builder.Services.AddAuthentication().AddBearerToken(IdentityConstants.BearerScheme);
builder.Services.AddIdentityCore<ApplicationUser>().AddRoles<IdentityRole>()
    .AddEntityFrameworkStores<ApplicationDbContext>().AddApiEndpoints();
```
Add:
```csharp
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.Authority = builder.Configuration["Auth:Authority"]; // dev http://localhost:5100 / prod https://auth.myceo.ir
        options.Audience = "mabhas19.api";
        options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
        options.TokenValidationParameters.NameClaimType = "name";
        options.TokenValidationParameters.RoleClaimType = "role";
    });
builder.Services.AddAuthorizationBuilder();
```
Keep `AddDbContext<ApplicationDbContext>` (still `IdentityDbContext` — no schema change) and `AddMabhas19Services(builder)`. Remove the OTP/SMS/Google service registrations from `AddMabhas19Services` (moved to IdP) and delete the now-unused files in `src/Infrastructure/Auth` + `External/GoogleTokenValidator`.

- [ ] **Step 2: Pipeline** — in `src/Web/Program.cs`, ensure `app.UseAuthentication(); app.UseAuthorization();` sit before `app.MapEndpoints(...)` (after `UseRateLimiter()`).

- [ ] **Step 3: Config** — add `"Auth": { "Authority": "http://localhost:5100" }` to `src/Web/appsettings.Development.json` and `"Auth": { "Authority": "https://auth.myceo.ir" }` to `appsettings.json`.

- [ ] **Step 4: Build the solution.** Run: `dotnet build Mabhas19.slnx` → resolve compile errors from removed Identity/OTP/Google references (Tasks B2). Expected after B2: PASS.

---

## Task B2: Remove local login surface; fix CurrentUser

**Files:** Delete `src/Web/Endpoints/Auth.cs`; modify `src/Web/Endpoints/Users.cs`, `src/Web/Services/CurrentUser.cs`, `src/Infrastructure/Identity/*`

- [ ] **Step 1: Delete** `src/Web/Endpoints/Auth.cs` (OTP/Google moved to IdP) and remove the `MapIdentityApi<ApplicationUser>()` mount (locate it — `Users.cs` or `Program.cs`).
- [ ] **Step 2: `Users.cs`** — keep `GET /api/Users/me` returning `{ roles, isAdmin }` computed from `HttpContext.User` claims (no `UserManager`). Remove register/login/refresh proxies.
- [ ] **Step 3: `CurrentUser.cs`** — confirm `Id => _accessor.HttpContext?.User?.FindFirstValue("sub")` (JWT subject) and `Roles` from `role` claims. Adjust claim keys to match the contract.
- [ ] **Step 4: Identity services** — `IdentityService`/`UserAdminService` use `UserManager`. They now operate on the (unused) `Mabhas19Db` users → out of scope. Remove their DI registration and references for endpoints that no longer exist; keep `ApplicationUser`/`ApplicationDbContext` types so the context still compiles. (Admin user-management is a flagged follow-up — leave `/api/Admin` returning 501 or remove its user-list action, noting it in the endpoint.)
- [ ] **Step 5: Build the solution.** Run: `dotnet build Mabhas19.slnx` → Expected: PASS (0 errors).
- [ ] **Step 6: Run existing tests.** Run: `dotnet test tests/Application.UnitTests/Application.UnitTests.csproj` and `tests/Domain.UnitTests/...` → PASS. (Functional tests touching old auth are updated in B3.)
- [ ] **Step 7: Commit.**
```bash
git add -A src/Web src/Infrastructure
git commit -m "feat(api): convert to JWT resource server; remove local login (moved to IdP)"
```

---

## Task B3: Contract-freeze integration test (the Phase 1 gate)

**Files:** Create `tests/Application.FunctionalTests/Auth/JwtResourceServerTests.cs`; modify `tests/Application.FunctionalTests/Infrastructure/WebApiFactory.cs`

**Goal:** prove the API accepts a valid IdP-shaped JWT and rejects others — using a test JWT signed by a key the test configures the API to trust (so the test doesn't need a live IdP).

- [ ] **Step 1: Test JWT helper** — generate an RSA key; issue a JWT with `iss`, `aud=mabhas19.api`, `sub`, `name`, `role` claims; expose the public key via a test JWKS. Configure `WebApiFactory` to point `Auth:Authority` at a stub or set `TokenValidationParameters.IssuerSigningKey` to the test key (override `AddJwtBearer` config in `ConfigureTestServices`).

- [ ] **Step 2: Failing test:**
```csharp
[Test]
public async Task Protected_endpoint_accepts_valid_idp_jwt()
{
    var token = TestJwt.For(userId: "u-123", roles: ["User"]);
    var client = _factory.CreateClient();
    client.DefaultRequestHeaders.Authorization = new("Bearer", token);
    var res = await client.GetAsync("/api/Projects");
    res.StatusCode.ShouldBe(HttpStatusCode.OK);
}

[Test]
public async Task Protected_endpoint_rejects_missing_or_wrong_audience_token()
{
    var client = _factory.CreateClient();
    (await client.GetAsync("/api/Projects")).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);

    client.DefaultRequestHeaders.Authorization = new("Bearer", TestJwt.For("u-1", ["User"], audience: "wrong"));
    (await client.GetAsync("/api/Projects")).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
}

[Test]
public async Task Admin_endpoint_requires_administrator_role_claim()
{
    var client = _factory.CreateClient();
    client.DefaultRequestHeaders.Authorization = new("Bearer", TestJwt.For("u-2", ["User"]));
    (await client.GetAsync("/api/Admin/users")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
}
```
- [ ] **Step 3: Run → fail**, then implement the helper + factory override → **pass**. Run: `dotnet test tests/Application.FunctionalTests/Application.FunctionalTests.csproj`.
- [ ] **Step 4: Re-run the full suite.** Run: `dotnet test Mabhas19.slnx` → PASS (update/remove obsolete tests that referenced the removed Identity/OTP endpoints).
- [ ] **Step 5: Commit.**
```bash
git add tests/Application.FunctionalTests
git commit -m "test(api): JWT resource-server contract tests (auth/audience/role)"
```

---

## Phase 1 exit gate — FREEZE THE CONTRACT

- [ ] IdP issues a signed, **unencrypted** JWT with `sub`/`name`/`email`/`role` and `aud=mabhas19.api` (A10 claims test green).
- [ ] API returns **200** for a valid IdP JWT, **401** for missing/wrong-audience, **403** for missing role (B3 green).
- [ ] `dotnet build Mabhas19.slnx` and `dotnet test Mabhas19.slnx` both green.
- [ ] Mark `plan_development/01-development/sso-oidc.md` §4 **FROZEN** (commit a one-line status edit). **Only then start Phase 2.**

---

## Self-review notes
- **Spec coverage:** A1–A10 = spec §5-A + §4 (IdP, login methods, clients/scopes, signing). B1–B3 = §5-B + the §8 Phase-1 gate. User migration (§7), web/mobile (§5 C/D), infra (§5 E) are Phases 2–3 — intentionally not planned here (build against the *frozen* contract).
- **No-prod-cutover (D5):** nothing in Phase 1 deploys or alters prod; the IdP runs locally against a dev `Mabhas19AuthDb`.
- **Type consistency:** claim keys (`sub`,`name`,`email`,`role`) identical across A4/A5 (issuer) and B1/B3 (validator); audience `mabhas19.api` consistent; `AuthUser` (IdP) vs `ApplicationUser` (API) kept separate by design (same Identity schema → migration maps rows).
- **Known follow-ups (documented, not gaps):** admin user-management migration to IdP; prod signing-cert provisioning (Phase 3); dropping `Mabhas19Db` Identity tables (future).
