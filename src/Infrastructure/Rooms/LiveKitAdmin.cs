using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Mabhas19.Application.Common.Interfaces.Rooms;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.Rooms;

/// <summary>
/// Admin calls to the media server over its Twirp API — plain JSON POSTs to
/// <c>/twirp/livekit.RoomService/{Method}</c>, authorised by a short-lived admin token.
/// </summary>
/// <remarks>
/// <para>
/// Hand-written for the same reason as the token service: no reachable NuGet, and the four calls used
/// here were verified against the live server before this file existed.
/// </para>
/// <para>
/// <b>Fail-soft everywhere.</b> A meeting list shows a live head-count on every row; if the media
/// server is slow or down, the list must still render with zeros rather than 500. Only token minting
/// is allowed to fail loudly, because a token is a security decision and a head-count is a nicety.
/// </para>
/// </remarks>
internal sealed class LiveKitAdmin(
    HttpClient http,
    ILiveKitAdminToken adminTokens,
    IRoomTokenService tokens,
    IOptions<LiveKitOptions> options,
    ILogger<LiveKitAdmin> logger) : ILiveKitAdmin
{
    private readonly LiveKitOptions _options = options.Value;

    public bool IsConfigured =>
        tokens.IsConfigured && !string.IsNullOrWhiteSpace(_options.ApiUrl);

    public async Task EnsureRoomAsync(string slug, int maxParticipants, CancellationToken cancellationToken = default)
        // CreateRoom is idempotent on the server: an existing room comes back unchanged.
        => await PostAsync<CreateRoomRequest, RoomInfo>(
            "CreateRoom",
            new CreateRoomRequest(slug, maxParticipants, EmptyTimeoutSeconds, DepartureTimeoutSeconds),
            cancellationToken);

    public async Task<int> LiveCountAsync(string slug, CancellationToken cancellationToken = default)
    {
        var counts = await LiveCountsAsync([slug], cancellationToken);
        return counts.TryGetValue(slug, out var n) ? n : 0;
    }

    public async Task<IReadOnlyDictionary<string, int>> LiveCountsAsync(
        IEnumerable<string> slugs,
        CancellationToken cancellationToken = default)
    {
        var wanted = slugs.Distinct(StringComparer.Ordinal).ToArray();
        if (wanted.Length == 0)
        {
            return new Dictionary<string, int>();
        }

        // One ListRooms for the whole page. Asking per room would be one round trip per table row to
        // another machine.
        var response = await PostAsync<ListRoomsRequest, ListRoomsResponse>(
            "ListRooms", new ListRoomsRequest(wanted), cancellationToken);

        var live = response?.Rooms ?? [];

        return wanted.ToDictionary(
            slug => slug,
            slug => live.FirstOrDefault(r => string.Equals(r.Name, slug, StringComparison.Ordinal))
                        ?.NumParticipants ?? 0,
            StringComparer.Ordinal);
    }

    public async Task EndRoomAsync(string slug, CancellationToken cancellationToken = default)
        => await PostAsync<DeleteRoomRequest, object>(
            "DeleteRoom", new DeleteRoomRequest(slug), cancellationToken);

    public async Task RemoveParticipantAsync(
        string slug,
        string identity,
        CancellationToken cancellationToken = default)
        => await PostAsync<RemoveParticipantRequest, object>(
            "RemoveParticipant", new RemoveParticipantRequest(slug, identity), cancellationToken);

    /// <summary>
    /// Posts one Twirp method. Returns default on any failure and never throws.
    /// </summary>
    private async Task<TResponse?> PostAsync<TRequest, TResponse>(
        string method,
        TRequest body,
        CancellationToken cancellationToken)
        where TResponse : class
    {
        if (!IsConfigured)
        {
            logger.LogWarning("LiveKit {Method} skipped: the media server is not configured.", method);
            return null;
        }

        try
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Post, $"twirp/livekit.RoomService/{method}")
            {
                Content = JsonContent.Create(body),
            };

            // A fresh, short-lived admin token per call. These methods need roomList/roomCreate/
            // roomAdmin, which a JOIN token deliberately never carries. Two minutes is far longer than
            // any of these calls takes, and short enough that a captured one is not a lasting key.
            request.Headers.Authorization = new AuthenticationHeaderValue(
                "Bearer", adminTokens.CreateAdminToken(TimeSpan.FromMinutes(2)));
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            using var response = await http.SendAsync(request, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                return typeof(TResponse) == typeof(object)
                    ? null
                    : await response.Content.ReadFromJsonAsync<TResponse>(cancellationToken);
            }

            // Status only — a failed body can echo room and participant names back.
            logger.LogWarning("LiveKit {Method} failed with {Status}.", method, (int)response.StatusCode);
            return null;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "LiveKit {Method} threw.", method);
            return null;
        }
    }

    private const int EmptyTimeoutSeconds = 300;
    private const int DepartureTimeoutSeconds = 60;

    private sealed record CreateRoomRequest(
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("max_participants")] int MaxParticipants,
        [property: JsonPropertyName("empty_timeout")] int EmptyTimeout,
        [property: JsonPropertyName("departure_timeout")] int DepartureTimeout);

    private sealed record ListRoomsRequest(
        [property: JsonPropertyName("names")] string[] Names);

    private sealed record ListRoomsResponse(
        [property: JsonPropertyName("rooms")] RoomInfo[]? Rooms);

    private sealed record RoomInfo(
        [property: JsonPropertyName("name")] string Name,
        [property: JsonPropertyName("num_participants")] int NumParticipants);

    private sealed record DeleteRoomRequest(
        [property: JsonPropertyName("room")] string Room);

    private sealed record RemoveParticipantRequest(
        [property: JsonPropertyName("room")] string Room,
        [property: JsonPropertyName("identity")] string Identity);
}
