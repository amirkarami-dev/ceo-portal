namespace Mabhas19.Application.Common.Interfaces.Rooms;

/// <summary>
/// Server-side control of live meetings, over the media server's admin API.
/// </summary>
/// <remarks>
/// <para>
/// <b>Every method is fail-soft.</b> If the media server is unreachable, a room does not exist, or a
/// participant has already left, these return a safe default instead of throwing. That is deliberate:
/// the meeting list shows a live head-count on every row, and a media-server hiccup must not turn the
/// whole page into a 500. The one place that must NOT be soft is minting a token — see
/// <see cref="IRoomTokenService"/>.
/// </para>
/// <para>
/// Nothing here trusts the caller. Authorisation happens in the handlers; by the time a method here
/// runs, the decision has already been made.
/// </para>
/// </remarks>
public interface ILiveKitAdmin
{
    /// <summary>Creates the room if it is not there yet. Idempotent.</summary>
    Task EnsureRoomAsync(string slug, int maxParticipants, CancellationToken cancellationToken = default);

    /// <summary>How many people are inside right now. 0 when the room is absent or unreachable.</summary>
    Task<int> LiveCountAsync(string slug, CancellationToken cancellationToken = default);

    /// <summary>
    /// Head-counts for many rooms in one call.
    /// </summary>
    /// <remarks>
    /// One request for the whole list, not one per row. A meeting list with twenty rows would otherwise
    /// make twenty round trips to another machine before it could render.
    /// </remarks>
    Task<IReadOnlyDictionary<string, int>> LiveCountsAsync(
        IEnumerable<string> slugs,
        CancellationToken cancellationToken = default);

    /// <summary>Ends the meeting now and disconnects everyone.</summary>
    Task EndRoomAsync(string slug, CancellationToken cancellationToken = default);

    /// <summary>Disconnects one participant. They can rejoin unless the meeting is also closed.</summary>
    Task RemoveParticipantAsync(
        string slug,
        string identity,
        CancellationToken cancellationToken = default);

    /// <summary>False when the media server is not configured.</summary>
    bool IsConfigured { get; }
}
