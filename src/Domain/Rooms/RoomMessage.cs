using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Rooms;

/// <summary>
/// One saved chat line. Chat is delivered live over the media server's data channel; this is the copy
/// that survives a reload and lets somebody who joined late read what they missed.
/// </summary>
/// <remarks>
/// <para>
/// Deliberately <b>not</b> <see cref="BaseAuditableEntity"/>'s full treatment for the author: the sender
/// is recorded in <see cref="SenderId"/> and <see cref="SenderName"/> explicitly, because a chat line
/// from a public link has no account behind it at all.
/// </para>
/// <para>
/// <see cref="IsGuest"/> is what stops a visitor passing for a member. Anyone joining a public
/// presentation types their own display name, so nothing prevents «مدیر سازمان» — the flag is how the
/// UI marks them as مهمان, and it is set by the server from the token, never from the request body.
/// </para>
/// </remarks>
public class RoomMessage : BaseAuditableEntity
{
    public int RoomId { get; set; }

    public Room Room { get; set; } = null!;

    /// <summary>Account id for a member, or the <c>guest-{random}</c> identity for a link visitor.</summary>
    public required string SenderId { get; set; }

    public required string SenderName { get; set; }

    /// <summary>True when the sender came in through a public link and has no account.</summary>
    public bool IsGuest { get; set; }

    public required string Text { get; set; }
}
