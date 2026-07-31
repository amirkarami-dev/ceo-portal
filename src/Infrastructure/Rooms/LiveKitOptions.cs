namespace Mabhas19.Infrastructure.Rooms;

/// <summary>
/// Connection details for the media server.
/// </summary>
/// <remarks>
/// The server is a dedicated LiveKit instance on its own machine, reached only over HTTPS for admin
/// calls; media never passes through this API. <see cref="ApiSecret"/> signs every join token, so it is
/// the single most sensitive value in this feature — it lives in <c>deploy/.env</c> and nowhere else.
/// </remarks>
public sealed class LiveKitOptions
{
    public const string SectionName = "LiveKit";

    /// <summary>Admin API base, e.g. <c>https://lk.myceo.ir</c>. Server-to-server only.</summary>
    public string ApiUrl { get; init; } = string.Empty;

    /// <summary>API key. Public half — it is the token's <c>iss</c> claim.</summary>
    public string ApiKey { get; init; } = string.Empty;

    /// <summary>
    /// API secret. Signs every join token.
    /// </summary>
    /// <remarks>
    /// A LiveKit secret is <b>not scoped to a room</b>: whoever holds it can mint a token for any room
    /// on that server. It must never reach the browser, a log line, or a tracked file.
    /// </remarks>
    public string ApiSecret { get; init; } = string.Empty;

    /// <summary>What the browser connects to, e.g. <c>wss://lk.myceo.ir</c>.</summary>
    public string PublicWsUrl { get; init; } = string.Empty;

    /// <summary>How long a join token stays valid.</summary>
    /// <remarks>
    /// Six hours covers any meeting plus a reconnect after a network drop. Shorter would eject people
    /// mid-meeting; much longer would leave a usable token lying in a browser for a working day.
    /// </remarks>
    public int TokenTtlHours { get; init; } = 6;
}
