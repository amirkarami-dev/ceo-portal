namespace Mabhas19.Application.Common.Interfaces.Rooms;

/// <summary>
/// What one participant is allowed to do once inside a meeting.
/// </summary>
/// <remarks>
/// This is the security core of the room service. Holding a signed token is the <b>only</b> way into a
/// meeting, and the media server enforces these flags itself — it refuses a published track that the
/// token does not allow. Nothing in the browser can widen them.
/// </remarks>
public sealed record RoomGrant(
    /// <summary>The media-server room name — <c>Room.Slug</c>. A token is valid for this room only.</summary>
    string RoomName,
    /// <summary>Stable participant identity. The کد ملی for a member, <c>guest-{random}</c> for a link visitor.</summary>
    string Identity,
    /// <summary>Shown to other participants.</summary>
    string DisplayName,
    /// <summary>
    /// Camera, microphone and screen share. <b>False for a presentation audience</b> — that single flag
    /// is what makes a public link safe to hand out.
    /// </summary>
    bool CanPublish,
    /// <summary>Chat and other data messages. True even for an audience.</summary>
    bool CanPublishData = true);

/// <summary>Mints media-server join tokens.</summary>
public interface IRoomTokenService
{
    /// <summary>
    /// Signs a join token for exactly one room and one participant.
    /// </summary>
    /// <remarks>
    /// Callers must have decided eligibility <b>before</b> calling this — the token service asks no
    /// questions and refuses nobody. See <c>Room.MayPublish</c> for where <see cref="RoomGrant.CanPublish"/>
    /// comes from.
    /// </remarks>
    string CreateJoinToken(RoomGrant grant, TimeSpan? ttl = null);

    /// <summary>False when no API key or secret is configured, so the feature reports unavailable
    /// rather than minting tokens nothing will accept.</summary>
    bool IsConfigured { get; }

    /// <summary>The public WebSocket address the browser connects to, e.g. <c>wss://lk.myceo.ir</c>.</summary>
    string PublicWsUrl { get; }
}
