using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Mabhas19.Application.Common.Interfaces.Rooms;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.Rooms;

/// <summary>
/// Mints the server-wide admin token the Twirp calls need.
/// </summary>
/// <remarks>
/// Kept off <see cref="IRoomTokenService"/> on purpose. That interface is reachable from the
/// Application layer, and a token carrying <c>roomAdmin</c> can end any meeting on the server — it is
/// not something a request handler should be able to ask for. Only <see cref="LiveKitAdmin"/>, in this
/// assembly, can.
/// </remarks>
internal interface ILiveKitAdminToken
{
    string CreateAdminToken(TimeSpan ttl);
}

/// <summary>
/// Signs LiveKit tokens by hand: a JWT, HS256, signed with the API secret.
/// </summary>
/// <remarks>
/// <para>
/// <b>Why hand-written rather than the community SDK.</b> NuGet is unreachable from the build machine
/// often enough to be a documented gotcha in this repo, and the wire format here is forty lines that
/// were already proven against the live server before any of this code existed. The trade is a
/// dependency we cannot always restore against a signature we can test exhaustively.
/// </para>
/// <para>
/// <b>The one thing that must never break:</b> LiveKit treats an <i>omitted</i> <c>canPublish</c> as
/// <c>true</c>. So an audience token that fails to serialise <c>"canPublish": false</c> does not fail
/// closed — it silently hands a microphone to every viewer of a public presentation. The serializer
/// below is configured to write every field, and a test asserts the raw JSON.
/// </para>
/// </remarks>
internal sealed class RoomTokenService(IOptions<LiveKitOptions> options)
    : IRoomTokenService, ILiveKitAdminToken
{
    private readonly LiveKitOptions _options = options.Value;

    /// <summary>
    /// Never omits a property. See the class remarks — a missing <c>canPublish</c> means "allowed".
    /// </summary>
    private static readonly JsonSerializerOptions Json = new()
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.Never,
    };

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(_options.ApiKey)
        && !string.IsNullOrWhiteSpace(_options.ApiSecret);

    public string PublicWsUrl => _options.PublicWsUrl;

    public string CreateJoinToken(RoomGrant grant, TimeSpan? ttl = null)
    {
        if (!IsConfigured)
        {
            // Better unavailable than unsigned: a token signed with an empty secret is one every
            // reader of this source could forge.
            throw new InvalidOperationException(
                "LiveKit:ApiKey / LiveKit:ApiSecret are not configured; meetings are unavailable.");
        }

        if (string.IsNullOrWhiteSpace(grant.RoomName) || string.IsNullOrWhiteSpace(grant.Identity))
        {
            // A grant with no room is valid for EVERY room on the server.
            throw new ArgumentException("A join grant needs a room name and an identity.", nameof(grant));
        }

        var now = DateTimeOffset.UtcNow;
        var lifetime = ttl ?? TimeSpan.FromHours(_options.TokenTtlHours);

        var payload = new Payload
        {
            Iss = _options.ApiKey,
            Sub = grant.Identity,
            // A few seconds of leeway: the media server and this API are different machines, and a
            // token stamped one second in their future is rejected outright.
            Nbf = now.AddSeconds(-10).ToUnixTimeSeconds(),
            Exp = now.Add(lifetime).ToUnixTimeSeconds(),
            Name = grant.DisplayName,
            Video = new VideoGrant
            {
                Room = grant.RoomName,
                RoomJoin = true,
                CanPublish = grant.CanPublish,
                CanSubscribe = true,
                CanPublishData = grant.CanPublishData,
                // Deliberately absent: no roomAdmin, no roomCreate, no roomList. Ending a meeting and
                // removing people are done by this API, where the caller's rights are checked. A
                // participant token that could do it itself would let a presenter's browser be tricked
                // into it.
            },
        };

        return Sign(JsonSerializer.SerializeToUtf8Bytes(payload, Json));
    }

    /// <inheritdoc/>
    public string CreateAdminToken(TimeSpan ttl)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException(
                "LiveKit:ApiKey / LiveKit:ApiSecret are not configured; meetings are unavailable.");
        }

        var now = DateTimeOffset.UtcNow;

        // No `room` claim: these grants are server-wide, which is exactly why this cannot be reached
        // from the Application layer. Minted fresh per call and valid for minutes, so a captured
        // admin token is not a lasting key to every meeting.
        var payload = new AdminPayload
        {
            Iss = _options.ApiKey,
            Sub = _options.ApiKey,
            Nbf = now.AddSeconds(-10).ToUnixTimeSeconds(),
            Exp = now.Add(ttl).ToUnixTimeSeconds(),
            Video = new AdminGrant
            {
                RoomList = true,
                RoomCreate = true,
                RoomAdmin = true,
            },
        };

        return Sign(JsonSerializer.SerializeToUtf8Bytes(payload, Json));
    }

    private string Sign(byte[] payloadBytes)
    {
        var head = Base64Url(JsonSerializer.SerializeToUtf8Bytes(new Header(), Json));
        var body = Base64Url(payloadBytes);
        var signingInput = $"{head}.{body}";

        var signature = HMACSHA256.HashData(
            Encoding.UTF8.GetBytes(_options.ApiSecret),
            Encoding.UTF8.GetBytes(signingInput));

        return $"{signingInput}.{Base64Url(signature)}";
    }

    /// <summary>JWT uses base64url with the padding stripped; plain base64 is rejected.</summary>
    private static string Base64Url(ReadOnlySpan<byte> bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');

    private sealed class Header
    {
        [JsonPropertyName("alg")] public string Alg => "HS256";

        [JsonPropertyName("typ")] public string Typ => "JWT";
    }

    private sealed class Payload
    {
        [JsonPropertyName("iss")] public string Iss { get; init; } = string.Empty;

        [JsonPropertyName("sub")] public string Sub { get; init; } = string.Empty;

        [JsonPropertyName("nbf")] public long Nbf { get; init; }

        [JsonPropertyName("exp")] public long Exp { get; init; }

        [JsonPropertyName("name")] public string Name { get; init; } = string.Empty;

        [JsonPropertyName("video")] public VideoGrant Video { get; init; } = new();
    }

    private sealed class AdminPayload
    {
        [JsonPropertyName("iss")] public string Iss { get; init; } = string.Empty;

        [JsonPropertyName("sub")] public string Sub { get; init; } = string.Empty;

        [JsonPropertyName("nbf")] public long Nbf { get; init; }

        [JsonPropertyName("exp")] public long Exp { get; init; }

        [JsonPropertyName("video")] public AdminGrant Video { get; init; } = new();
    }

    private sealed class AdminGrant
    {
        [JsonPropertyName("roomList")] public bool RoomList { get; init; }

        [JsonPropertyName("roomCreate")] public bool RoomCreate { get; init; }

        [JsonPropertyName("roomAdmin")] public bool RoomAdmin { get; init; }
    }

    private sealed class VideoGrant
    {
        [JsonPropertyName("room")] public string Room { get; init; } = string.Empty;

        [JsonPropertyName("roomJoin")] public bool RoomJoin { get; init; }

        [JsonPropertyName("canPublish")] public bool CanPublish { get; init; }

        [JsonPropertyName("canSubscribe")] public bool CanSubscribe { get; init; }

        [JsonPropertyName("canPublishData")] public bool CanPublishData { get; init; }
    }
}
