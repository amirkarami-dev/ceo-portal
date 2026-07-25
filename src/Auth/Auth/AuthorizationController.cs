using System.Collections.Immutable;
using System.Security.Claims;
using Mabhas19.Auth.Data;
using Mabhas19.Auth.External;
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
    UserManager<AuthUser> userManager,
    IFarsNezamDirectory farsDirectory,
    IServiceAccessStore serviceAccess) : Controller
{
    private const string FarsHintPrefix = "fars:";

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

        if (!result.Succeeded)
        {
            // FarsNezam magic-link: an unauthenticated authorize carrying login_hint=fars:<CodeOzveyat>
            // is routed to the auto-provisioning page instead of the interactive login.
            if (farsCo is not null)
            {
                return RedirectToFarsLogin(farsCo, returnUrl);
            }

            // The welfare app signs engineers in by کد ملی + OTP, not username/password — its
            // unauthenticated authorize goes to the engineer login instead of the default page.
            if (string.Equals(request.ClientId, "walfare-web", StringComparison.OrdinalIgnoreCase))
            {
                return Redirect($"/Account/EngineerLogin?returnUrl={Uri.EscapeDataString(returnUrl)}");
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

        // Per-service access gate. Map the requesting client_id -> product service key; a user with a
        // NON-EMPTY grant list may only reach services in it. Grandfather rule: an empty grant list
        // (existing / self-provisioned users) allows everything. Clients not tied to a grantable
        // service (e.g. admin-web) map to null and are never blocked here. The login itself already
        // happened above — only issuing the token for this service is denied.
        var serviceKey = ServiceKeys.ServiceKeyForClient(request.ClientId);
        if (serviceKey is not null)
        {
            var grants = await serviceAccess.GetServiceKeysAsync(user.Id, HttpContext.RequestAborted);
            if (grants.Count > 0 && !grants.Contains(serviceKey, StringComparer.OrdinalIgnoreCase))
            {
                return Forbid(
                    authenticationSchemes: OpenIddictServerAspNetCoreDefaults.AuthenticationScheme,
                    properties: new AuthenticationProperties(new Dictionary<string, string?>
                    {
                        [OpenIddictServerAspNetCoreConstants.Properties.Error] = Errors.AccessDenied,
                        [OpenIddictServerAspNetCoreConstants.Properties.ErrorDescription] =
                            "شما به این سرویس دسترسی ندارید."
                    }));
            }
        }

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
