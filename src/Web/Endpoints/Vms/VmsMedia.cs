using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Vms;
using Mabhas19.Domain.Constants;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.Extensions.Options;

namespace Mabhas19.Web.Endpoints.Vms;

/// <summary>
/// Opens and checks a media session. Auto-mapped to <c>/api/VmsMedia</c>.
/// </summary>
/// <remarks>
/// <para>
/// Two routes with deliberately different doors. <c>session</c> is for the SPA and needs an
/// administrator's bearer token. <c>check</c> is for <b>Traefik on the media VPS</b>, which calls it
/// as a <c>forwardAuth</c> before letting any stream request reach go2rtc — so it is anonymous and
/// judges the request purely on the cookie the browser attached.
/// </para>
/// <para>
/// The cookie exists because a <c>&lt;video&gt;</c> element cannot send an <c>Authorization</c>
/// header. See <see cref="VmsMediaToken"/> for the reasoning.
/// </para>
/// </remarks>
public class VmsMedia : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/VmsMedia";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization(policy => policy.RequireRole(Roles.Administrator));

        groupBuilder.MapPost(CreateVmsMediaSession, "session");
        groupBuilder.MapDelete(EndVmsMediaSession, "session");

        // Traefik has no bearer token and no identity of its own. It forwards the viewer's request
        // headers, cookie included, and asks whether to let it through.
        groupBuilder.MapGet(CheckVmsMediaAccess, "check").AllowAnonymous();
    }

    public sealed record VmsMediaSessionDto(DateTimeOffset ExpiresAtUtc, int TtlSeconds);

    /// <summary>Trades the SPA's bearer token for a cookie the browser will send to the gateway.</summary>
    public static Results<Ok<VmsMediaSessionDto>, StatusCodeHttpResult> CreateVmsMediaSession(
        IOptions<VmsMediaOptions> options,
        IUser user,
        TimeProvider clock,
        HttpContext http)
    {
        var config = options.Value;

        // Fail closed, and loudly. Minting under a default key would produce cookies the gateway
        // rejects — video that never starts, with nothing in the browser to explain it.
        if (!config.IsConfigured)
        {
            return TypedResults.StatusCode(StatusCodes.Status503ServiceUnavailable);
        }

        var expires = clock.GetUtcNow().AddMinutes(config.TokenMinutes);
        var token = VmsMediaToken.Issue(user.Id ?? string.Empty, expires, config.Key);

        http.Response.Cookies.Append(config.CookieName, token, new CookieOptions
        {
            // The browser attaches this by itself to cam.myceo.ir — which is the whole point, and
            // also why it must not be readable by script.
            HttpOnly = true,
            Secure = true,

            // Lax, not None. vms.myceo.ir → cam.myceo.ir is *same-site* (one registrable domain), so
            // Lax is sent; None would additionally hand the cookie to any third-party page.
            SameSite = SameSiteMode.Lax,

            Domain = string.IsNullOrWhiteSpace(config.CookieDomain) ? null : config.CookieDomain,
            Path = "/",
            Expires = expires,
            IsEssential = true
        });

        var ttl = (int)Math.Max(0, (expires - clock.GetUtcNow()).TotalSeconds);
        return TypedResults.Ok(new VmsMediaSessionDto(expires, ttl));
    }

    /// <summary>Drops the cookie. Signing out of the panel should not leave a usable media session.</summary>
    public static NoContent EndVmsMediaSession(IOptions<VmsMediaOptions> options, HttpContext http)
    {
        var config = options.Value;

        http.Response.Cookies.Delete(config.CookieName, new CookieOptions
        {
            // Domain and path must match the ones it was set with, or the browser keeps the original.
            Domain = string.IsNullOrWhiteSpace(config.CookieDomain) ? null : config.CookieDomain,
            Path = "/",
            Secure = true,
            HttpOnly = true,
            SameSite = SameSiteMode.Lax
        });

        return TypedResults.NoContent();
    }

    /// <summary>
    /// Traefik's <c>forwardAuth</c> target: 204 lets the stream request through, 401 stops it.
    /// </summary>
    /// <remarks>
    /// Returns no body on success. Traefik copies selected response headers onto the forwarded
    /// request and discards the rest, so anything here would be wasted work on a very hot path.
    /// </remarks>
    public static Results<NoContent, UnauthorizedHttpResult> CheckVmsMediaAccess(
        IOptions<VmsMediaOptions> options,
        TimeProvider clock,
        HttpContext http)
    {
        var config = options.Value;

        if (!config.IsConfigured)
        {
            return TypedResults.Unauthorized();
        }

        var token = http.Request.Cookies[config.CookieName];

        return VmsMediaToken.Verify(token, config.Key, clock.GetUtcNow()) is null
            ? TypedResults.Unauthorized()
            : TypedResults.NoContent();
    }
}
