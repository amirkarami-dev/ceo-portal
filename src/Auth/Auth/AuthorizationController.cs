using System.Collections.Immutable;
using System.Security.Claims;
using Mabhas19.Auth.Data;
using Mabhas19.Auth.External;
using Microsoft.AspNetCore;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Primitives;
using OpenIddict.Abstractions;
using OpenIddict.Server.AspNetCore;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Mabhas19.Auth;

public class AuthorizationController(
    SignInManager<AuthUser> signInManager,
    UserManager<AuthUser> userManager,
    IFarsNezamDirectory farsDirectory,
    IServiceAccessStore serviceAccess) : Controller
{
    private const string FarsHintPrefix = "fars:";

    /// <summary>
    /// Clients whose users are engineers signing in with کد ملی + OTP, mapped to the service hint the
    /// login page uses for its heading and for the single grant a new account receives.
    /// </summary>
    private static readonly Dictionary<string, string> EngineerLoginClients =
        new(StringComparer.OrdinalIgnoreCase)
        {
            ["walfare-web"]  = "walfare",
            ["election-web"] = "election",
            ["room-web"]     = "room",
        };

    [HttpGet("connect/authorize"), HttpPost("connect/authorize")]
    public async Task<IActionResult> Authorize()
    {
        var request = HttpContext.GetOpenIddictServerRequest()!;
        var result = await HttpContext.AuthenticateAsync(IdentityConstants.ApplicationScheme);

        var farsCo = !string.IsNullOrEmpty(request.LoginHint) &&
                     request.LoginHint.StartsWith(FarsHintPrefix, StringComparison.OrdinalIgnoreCase)
            ? request.LoginHint[FarsHintPrefix.Length..]
            : null;

        var returnUrl = Request.PathBase + Request.Path + QueryString.Create(
            Request.HasFormContentType ? Request.Form : Request.Query);

        // prompt=login means "ask for credentials even if a session already exists". Without this
        // the parameter is silently ignored, and the "ورود با حساب دیگر" button on a service the
        // user has no grant for would bounce straight off the still-valid SSO cookie and be refused
        // again — the exact loop that button exists to break. Sign the cookie out and fall into the
        // unauthenticated path below, which routes to the right login screen for this client.
        if (result.Succeeded && request.HasPromptValue(PromptValues.Login))
        {
            await signInManager.SignOutAsync();

            // The prompt must not survive into returnUrl, or the login page would post back here,
            // sign the freshly-authenticated user out again, and loop.
            var query = Request.HasFormContentType ? Request.Form : (IEnumerable<KeyValuePair<string, StringValues>>)Request.Query;
            var withoutPrompt = QueryString.Create(query
                .Where(p => !string.Equals(p.Key, Parameters.Prompt, StringComparison.Ordinal))
                .SelectMany(p => p.Value.Select(v => new KeyValuePair<string, string?>(p.Key, v))));

            return Challenge(
                authenticationSchemes: IdentityConstants.ApplicationScheme,
                properties: new AuthenticationProperties
                {
                    RedirectUri = Request.PathBase + Request.Path + withoutPrompt
                });
        }

        if (!result.Succeeded)
        {
            // FarsNezam magic-link: an unauthenticated authorize carrying login_hint=fars:<CodeOzveyat>
            // is routed to the auto-provisioning page instead of the interactive login.
            if (farsCo is not null)
            {
                return RedirectToFarsLogin(farsCo, returnUrl);
            }

            // The engineer-facing apps sign people in by کد ملی + OTP, not username/password — their
            // unauthenticated authorize goes to the engineer login instead of the default page. Engineer
            // accounts have NO password, so sending them to /Account/Login would be a dead end.
            // Administrators reach these apps through the shared SSO cookie, or via the
            // "ورود مدیران" link on that page.
            if (EngineerLoginClients.TryGetValue(request.ClientId ?? string.Empty, out var service))
            {
                return Redirect(
                    $"/Account/EngineerLogin?returnUrl={Uri.EscapeDataString(returnUrl)}&service={service}");
            }

            return Challenge(
                authenticationSchemes: IdentityConstants.ApplicationScheme,
                properties: new AuthenticationProperties { RedirectUri = returnUrl });
        }

        // Magic-link while ALREADY signed in (possibly as someone else): the link's engineer
        // must win. Loop-safe: once FarsLogin signs the engineer in, usernames match and we
        // fall through.
        if (farsCo is not null)
        {
            var current = await userManager.GetUserAsync(result.Principal!);
            var engineer = await farsDirectory.GetByCodeOzveyatAsync(farsCo, HttpContext.RequestAborted);

            // Invalid code: don't silently proceed as the current user — route to FarsLogin so
            // the user sees the "not found" error instead of getting someone else's session.
            if (engineer is null)
            {
                return RedirectToFarsLogin(farsCo, returnUrl);
            }

            // Different engineer than the current session → switch identity via FarsLogin.
            if (!string.Equals(current?.UserName, engineer.CodeMeli, StringComparison.OrdinalIgnoreCase))
            {
                await signInManager.SignOutAsync();
                return RedirectToFarsLogin(farsCo, returnUrl);
            }
        }

        var user = await userManager.GetUserAsync(result.Principal!)
                   ?? throw new InvalidOperationException("User not found.");

        if (await DenyServiceAsync(user, request.ClientId) is { } denied)
            return denied;

        var principal = await BuildPrincipalAsync(user, request.GetScopes());
        return SignIn(principal, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }

    /// <summary>
    /// Per-service access gate. Maps the requesting <c>client_id</c> to a product service key; a
    /// user with a NON-EMPTY grant list may only reach services in it. Returns the <c>Forbid</c>
    /// result to send back, or <c>null</c> when the user may proceed.
    /// </summary>
    /// <remarks>
    /// Three rules, in order:
    /// <list type="bullet">
    /// <item>A <c>SuperUser</c> is never gated. That is the role's entire purpose — without it,
    /// narrowing an administrator's grants could leave nobody able to widen them again.</item>
    /// <item>Grandfather rule: an EMPTY grant list allows everything. Most accounts have one, and
    /// this is what "add an admin, assign nothing, they get everything" means.</item>
    /// <item>Some clients gate administrators only (<c>election-web</c>, <c>room-web</c>,
    /// <c>vms-web</c>) — never engineers. See <c>ServiceKeys.AdminGatedClientToKey</c>.</item>
    /// </list>
    /// The login itself has already happened by the time this runs — only issuing the token for
    /// this one service is denied, so the person stays signed in and can switch service.
    /// <para>
    /// This gates the <b>authorize</b> and <b>token</b> endpoints, i.e. who may sign in to a
    /// service. It is NOT an API-level permission: the resource server validates issuer and
    /// audience only (see <c>Infrastructure/DependencyInjection.cs</c>), so it does not care which
    /// client minted a token. Per-endpoint authorisation stays the job of the role checks on the
    /// API itself.
    /// </para>
    /// </remarks>
    private async Task<IActionResult?> DenyServiceAsync(AuthUser user, string? clientId)
    {
        var roles = await userManager.GetRolesAsync(user);

        if (roles.Any(r => string.Equals(r, "SuperUser", StringComparison.OrdinalIgnoreCase)))
            return null;

        var hasAdminPowers = roles.Any(r =>
            string.Equals(r, "Administrator", StringComparison.OrdinalIgnoreCase));

        var serviceKey = ServiceKeys.ServiceKeyForClient(clientId)
                         ?? (hasAdminPowers ? ServiceKeys.AdminGatedServiceKeyForClient(clientId) : null);

        if (serviceKey is null)
            return null;

        var grants = await serviceAccess.GetServiceKeysAsync(user.Id, HttpContext.RequestAborted);
        if (grants.Count == 0 || grants.Contains(serviceKey, StringComparer.OrdinalIgnoreCase))
            return null;

        return Forbid(
            authenticationSchemes: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            properties: new AuthenticationProperties(new Dictionary<string, string?>
            {
                [OpenIddictServerAspNetCoreConstants.Properties.Error] = Errors.AccessDenied,
                [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] =
                    "شما به این سرویس دسترسی ندارید."
            }));
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

        // Re-check the grant on every exchange, not just at authorize. On the refresh_token grant
        // this is the ONLY place the check can happen — without it, narrowing someone's services
        // would not take effect until their refresh token expired, and a revoked service would keep
        // renewing itself in the background. (No client currently requests `offline_access`, so no
        // refresh token is issued today and this is belt-and-braces — but every client is registered
        // with the RefreshToken grant, so the hole is one scope string away from being real.)
        if (await DenyServiceAsync(user, request.ClientId) is { } denied)
            return denied;

        var principal = await BuildPrincipalAsync(user, auth.Principal!.GetScopes());
        return SignIn(principal, OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);
    }

    [HttpGet("connect/userinfo")]
    public async Task<IActionResult> UserInfo()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
            return Challenge(OpenIddictServerAspNetCoreDefaults.AuthenticationScheme);

        return Ok(new Dictionary<string, object?>
        {
            [Claims.Subject] = user.Id,
            [Claims.Name]    = user.UserName,
            [Claims.Email]   = user.Email
        });
    }

    [HttpGet("connect/logout"), HttpPost("connect/logout")]
    public async Task<IActionResult> Logout()
    {
        await signInManager.SignOutAsync();
        return SignOut(
            authenticationSchemes: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
            properties: new AuthenticationProperties { RedirectUri = "/" });
    }

    private RedirectResult RedirectToFarsLogin(string co, string returnUrl) =>
        Redirect($"/Account/FarsLogin?co={Uri.EscapeDataString(co)}&returnUrl={Uri.EscapeDataString(returnUrl)}");

    private async Task<ClaimsPrincipal> BuildPrincipalAsync(AuthUser user, IEnumerable<string> scopes)
    {
        var principal = await signInManager.CreateUserPrincipalAsync(user);

        principal.SetClaim(Claims.Subject,          user.Id);
        principal.SetClaim(Claims.Name,             user.UserName);
        principal.SetClaim(Claims.Email,            user.Email);
        principal.SetClaim("preferred_username",    user.UserName);

        // SetClaims requires ImmutableArray<string> — convert the IList<string> returned by GetRolesAsync.
        var roles = await userManager.GetRolesAsync(user);
        principal.SetClaims(Claims.Role, roles.ToImmutableArray());

        // Multi-valued 'svc' claim = the product services this user may use (empty = grandfathered).
        // Runs on authorize AND refresh, so a refreshed token always reflects the current grants.
        var services = await serviceAccess.GetServiceKeysAsync(user.Id, HttpContext.RequestAborted);
        principal.SetClaims("svc", services.ToImmutableArray());

        principal.SetScopes(scopes);
        principal.SetResources("mabhas19.api");
        principal.SetDestinations(OpenIddictClaimDestinations.For);

        return principal;
    }
}
