using System.Buffers.Text;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Mabhas19.Application.Vms;

/// <summary>
/// The short-lived proof a browser shows the media gateway.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why a token at all, when the SPA already holds a JWT.</b> A <c>&lt;video&gt;</c> element and a
/// WebSocket handshake cannot carry an <c>Authorization</c> header — the browser builds those requests
/// itself. So the bearer token the SPA holds is unusable for the one thing that matters here. What a
/// browser *does* attach on its own is a cookie, so the API trades a bearer token for a cookie the
/// browser will send to <c>cam.myceo.ir</c>, and Traefik there asks us whether it is any good.
/// </para>
/// <para>
/// <b>Why signed rather than a database row.</b> Every media request goes through forwardAuth — a
/// segment, a reconnect, every tile on the wall. A signature is a hash; a lookup would be a query per
/// frame-ish request. It also means the check has no state to get out of step with.
/// </para>
/// <para>
/// It says nothing about *which* camera. Authorisation for this service is one bit — administrator or
/// not — because the design settled that only administrators may watch and a city is classification,
/// not permission. If that ever changes, the payload is where the scope would go.
/// </para>
/// </remarks>
public static class VmsMediaToken
{
    /// <summary>Bumped if the payload shape ever changes, so an old token cannot be misread as a new one.</summary>
    private const string Version = "v1";

    public sealed record Payload(string Subject, DateTimeOffset ExpiresAt);

    /// <summary>
    /// <c>base64url(v1.exp.subject).base64url(hmac)</c>.
    /// </summary>
    public static string Issue(string subject, DateTimeOffset expiresAt, byte[] key)
    {
        var body = $"{Version}.{expiresAt.ToUnixTimeSeconds().ToString(CultureInfo.InvariantCulture)}.{subject}";
        var bodyBytes = Encoding.UTF8.GetBytes(body);

        return $"{Base64Url(bodyBytes)}.{Base64Url(HMACSHA256.HashData(key, bodyBytes))}";
    }

    /// <summary>The payload if the token is genuine and unexpired, otherwise null.</summary>
    /// <remarks>
    /// One null for every failure on purpose. The caller answers 401 either way, and a message that
    /// distinguished "expired" from "forged" would tell somebody probing which half to work on.
    /// </remarks>
    public static Payload? Verify(string? token, byte[] key, DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(token) || key.Length == 0)
        {
            return null;
        }

        var dot = token.IndexOf('.', StringComparison.Ordinal);
        if (dot <= 0 || dot == token.Length - 1 || token.IndexOf('.', dot + 1) >= 0)
        {
            return null;
        }

        byte[] bodyBytes, signature;
        try
        {
            bodyBytes = FromBase64Url(token[..dot]);
            signature = FromBase64Url(token[(dot + 1)..]);
        }
        catch (FormatException)
        {
            return null;
        }

        // Fixed time, and only on equal lengths — CryptographicOperations.FixedTimeEquals returns
        // false for a length mismatch without comparing, which is what we want.
        if (!CryptographicOperations.FixedTimeEquals(HMACSHA256.HashData(key, bodyBytes), signature))
        {
            return null;
        }

        var parts = Encoding.UTF8.GetString(bodyBytes).Split('.', 3);
        if (parts.Length != 3
            || !string.Equals(parts[0], Version, StringComparison.Ordinal)
            || !long.TryParse(parts[1], NumberStyles.None, CultureInfo.InvariantCulture, out var exp))
        {
            return null;
        }

        var expiresAt = DateTimeOffset.FromUnixTimeSeconds(exp);

        // Checked after the signature, so an expired-but-genuine token and a forged one cost the
        // same work and answer the same way.
        return expiresAt <= now ? null : new Payload(parts[2], expiresAt);
    }

    private static string Base64Url(byte[] value) =>
        Convert.ToBase64String(value).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private static byte[] FromBase64Url(string value)
    {
        var s = value.Replace('-', '+').Replace('_', '/');
        return Convert.FromBase64String(s.PadRight(s.Length + ((4 - (s.Length % 4)) % 4), '='));
    }
}

/// <summary>
/// How the media cookie is minted and where it is valid.
/// </summary>
public sealed class VmsMediaOptions
{
    public const string SectionName = "VmsMedia";

    /// <summary>Base64 of 32 random bytes. Empty means the whole feature refuses, in both directions.</summary>
    public string TokenSecret { get; init; } = string.Empty;

    /// <summary>
    /// The cookie's <c>Domain</c>, e.g. <c>.myceo.ir</c>.
    /// </summary>
    /// <remarks>
    /// It has to be the parent domain: the cookie is set by <c>api.myceo.ir</c> and must be sent to
    /// <c>cam.myceo.ir</c>. Empty leaves it host-only, which is right for a local run and useless in
    /// production — so an empty value is a configuration mistake worth noticing, not a default to rely
    /// on.
    /// </remarks>
    public string CookieDomain { get; init; } = string.Empty;

    /// <summary>
    /// How long a media session lasts.
    /// </summary>
    /// <remarks>
    /// An hour: long enough that nobody watching a wall is interrupted, short enough that a cookie
    /// copied off a machine stops working the same morning. The SPA renews it in the background.
    /// </remarks>
    public int TokenMinutes { get; init; } = 60;

    public string CookieName { get; init; } = "vms_media";

    public bool IsConfigured => Key.Length > 0;

    /// <summary>The signing key, or empty when unset or unusable.</summary>
    public byte[] Key
    {
        get
        {
            if (string.IsNullOrWhiteSpace(TokenSecret))
            {
                return [];
            }

            Span<byte> buffer = stackalloc byte[64];
            return Base64.IsValid(TokenSecret) && Convert.TryFromBase64String(TokenSecret, buffer, out var written)
                ? buffer[..written].ToArray()
                : Encoding.UTF8.GetBytes(TokenSecret);
        }
    }
}
