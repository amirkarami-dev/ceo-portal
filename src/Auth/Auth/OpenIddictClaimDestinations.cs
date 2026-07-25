using System.Security.Claims;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Mabhas19.Auth;

public static class OpenIddictClaimDestinations
{
    // Explicit allowlist: only these claims are emitted into tokens. Everything else
    // (ASP.NET Identity's internal claims — security stamp, duplicate name-identifier, etc.)
    // gets NO destination and is excluded from both tokens.
    public static IEnumerable<string> For(Claim claim) => claim.Type switch
    {
        Claims.Subject          => [Destinations.AccessToken, Destinations.IdentityToken],
        Claims.Name             => [Destinations.AccessToken, Destinations.IdentityToken],
        Claims.Email            => [Destinations.AccessToken, Destinations.IdentityToken],
        Claims.Role             => [Destinations.AccessToken, Destinations.IdentityToken],
        "preferred_username"    => [Destinations.AccessToken, Destinations.IdentityToken],
        "svc"                   => [Destinations.AccessToken, Destinations.IdentityToken],
        _                       => []
    };
}
