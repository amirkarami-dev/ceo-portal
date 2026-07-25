using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.IdentityModel.Tokens;

namespace Mabhas19.Application.FunctionalTests.Infrastructure;

/// <summary>
/// Produces signed JWTs for use in JWT resource-server contract tests.
/// </summary>
public static class JwtTokenHelper
{
    /// <summary>
    /// Issues a signed JWT with the supplied parameters.
    /// </summary>
    /// <param name="signingKey">The RSA key to sign the token with.</param>
    /// <param name="sub">The subject (user id) claim.</param>
    /// <param name="roles">Zero or more role claims (claim type <c>role</c>).</param>
    /// <param name="issuer">Issuer; defaults to <see cref="JwtWebApiFactory.TestIssuer"/>.</param>
    /// <param name="audience">Audience; defaults to <see cref="JwtWebApiFactory.TestAudience"/>.</param>
    /// <param name="expiry">Token lifetime; defaults to 1 hour.</param>
    public static string IssueToken(
        RsaSecurityKey signingKey,
        string sub = "test-user-id",
        string[] roles = null!,
        string issuer = JwtWebApiFactory.TestIssuer,
        string audience = JwtWebApiFactory.TestAudience,
        TimeSpan? expiry = null)
    {
        roles ??= [];

        var claims = new List<Claim>
        {
            new("sub", sub),
            new("name", sub)
        };

        foreach (var role in roles)
        {
            claims.Add(new Claim("role", role));
        }

        var credentials = new SigningCredentials(signingKey, SecurityAlgorithms.RsaSha256);
        var now = DateTime.UtcNow;

        var jwt = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: now,
            expires: now.Add(expiry ?? TimeSpan.FromHours(1)),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(jwt);
    }
}
