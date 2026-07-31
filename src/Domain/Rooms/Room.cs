using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Rooms;

/// <summary>What kind of meeting this is. Decides who may publish and how people get in.</summary>
public enum RoomType
{
    /// <summary>
    /// Everyone is equal: all attendees may use camera, microphone and screen share. Attendance is
    /// controlled by an invite list, and there is no join link.
    /// </summary>
    Meeting = 0,

    /// <summary>
    /// One-to-many. Exactly one presenter publishes; everyone else watches, listens and may chat.
    /// Attendance is by link, gated by <see cref="RoomJoinMode"/>.
    /// </summary>
    Presentation = 1
}

/// <summary>How somebody gets into the meeting.</summary>
public enum RoomJoinMode
{
    /// <summary>Only people on the invite list. No link. <see cref="RoomType.Meeting"/> only.</summary>
    InviteOnly = 0,

    /// <summary>
    /// By link, but the visitor must prove who they are with کد ملی + SMS code — the same engineer
    /// login the welfare and election services use. Only members of the organisation get in.
    /// </summary>
    Private = 1,

    /// <summary>
    /// By link, with nothing but a typed name. Anyone holding the link may watch.
    /// </summary>
    /// <remarks>
    /// Allowed for <see cref="RoomType.Presentation"/> only, and that restriction is the point: a public
    /// link into an equal-footing meeting would let a stranger switch a camera on in a committee room.
    /// In a presentation the audience token carries <c>canPublish: false</c>, so the worst a
    /// gate-crasher can do is watch.
    /// </remarks>
    Public = 2
}

/// <summary>
/// One video meeting, e.g. «جلسه هیئت مدیره» or a public «ارائه».
/// </summary>
/// <remarks>
/// <para>
/// <see cref="Slug"/> is the room name on the media server, and it always carries the <c>ceo-</c>
/// prefix. That prefix is not cosmetic: the media server is shared with nothing today, but a room name
/// is the only thing a join token is scoped to, so an unprefixed name is one careless config change
/// away from colliding with another product's meeting.
/// </para>
/// <para>
/// <see cref="JoinToken"/> is the secret in the join link — never the id. It can be regenerated, which
/// is the only way to invalidate a link that has been forwarded to the wrong people.
/// </para>
/// </remarks>
public class Room : BaseAuditableEntity
{
    public required string Name { get; set; }

    public string? Description { get; set; }

    /// <summary>Unique; the media-server room name. Always <c>ceo-{8 hex}</c>.</summary>
    public required string Slug { get; set; }

    public RoomType Type { get; set; } = RoomType.Meeting;

    public RoomJoinMode JoinMode { get; set; } = RoomJoinMode.InviteOnly;

    /// <summary>
    /// 32 hex characters, the secret half of the join link. Null when the meeting has no link
    /// (<see cref="RoomJoinMode.InviteOnly"/>).
    /// </summary>
    public string? JoinToken { get; set; }

    /// <summary>The one account allowed to publish in a <see cref="RoomType.Presentation"/>.</summary>
    public string? PresenterUserId { get; set; }

    /// <summary>Denormalised so the join page can name the presenter without a directory call.</summary>
    public string? PresenterName { get; set; }

    /// <summary>When the doors open. Joining before this is refused, minus the grace below.</summary>
    public DateTimeOffset StartsAtUtc { get; set; }

    /// <summary>
    /// How many minutes before <see cref="StartsAtUtc"/> people may already come in.
    /// </summary>
    /// <remarks>
    /// Zero would mean a room full of people watching a countdown hit zero and then all reconnecting at
    /// once. Ten minutes lets them arrive, sort their microphone out and wait.
    /// </remarks>
    public int EarlyJoinMinutes { get; set; } = 10;

    /// <summary>Shown to attendees. Nothing is enforced on it in v1 — meetings end when people leave.</summary>
    public int? DurationMinutes { get; set; }

    public int MaxParticipants { get; set; } = 50;

    /// <summary>False stops new joins. People already inside are not kicked.</summary>
    public bool IsActive { get; set; } = true;

    public bool IsDeleted { get; set; }

    public IList<RoomInvite> Invites { get; init; } = new List<RoomInvite>();

    /// <summary>The instant before which nobody may join.</summary>
    public DateTimeOffset OpensAtUtc => StartsAtUtc.AddMinutes(-EarlyJoinMinutes);

    /// <summary>True when the doors are open right now.</summary>
    public bool IsOpenAt(DateTimeOffset now) => IsActive && !IsDeleted && now >= OpensAtUtc;

    /// <summary>
    /// Whether <paramref name="userId"/> may publish camera, microphone and screen.
    /// </summary>
    /// <remarks>
    /// This is what the join token is built from, so it is the real gate — not a UI decision. In a
    /// presentation only the presenter publishes; in a meeting everyone does.
    /// </remarks>
    public bool MayPublish(string? userId) => Type switch
    {
        RoomType.Presentation => userId is not null
                                 && string.Equals(userId, PresenterUserId, StringComparison.Ordinal),
        _ => true
    };
}
