using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Rooms;

/// <summary>
/// One person an administrator allowed into a <see cref="RoomType.Meeting"/>.
/// </summary>
/// <remarks>
/// Only meetings use invites. A presentation is reached by link, so inviting people to one would be two
/// gates disagreeing with each other — the rules on <c>Room</c> refuse that combination.
/// </remarks>
public class RoomInvite : BaseAuditableEntity
{
    public int RoomId { get; set; }

    public Room Room { get; set; } = null!;

    /// <summary>The invited account. For engineers this is their کد ملی, as everywhere else here.</summary>
    public required string UserId { get; set; }

    /// <summary>
    /// Denormalised display name, captured when the invite was made.
    /// </summary>
    /// <remarks>
    /// Stored rather than looked up so the admin screen can list who is invited without one directory
    /// call per row, and so the list still reads sensibly if somebody later leaves the organisation.
    /// </remarks>
    public string? UserName { get; set; }
}
