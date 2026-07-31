using System.Security.Cryptography;
using Mabhas19.Domain.Rooms;

namespace Mabhas19.Application.Rooms;

/// <summary>
/// The shape rules for a meeting, with no database and no clock.
/// </summary>
/// <remarks>
/// These mirror the CHECK constraints on <c>Rooms</c> exactly. The database is what guarantees them;
/// this is what turns a violation into a Persian sentence instead of a 500. If the two ever disagree,
/// the database wins and the admin sees an unexplained error — so they are listed side by side in
/// <c>RoomConfigurations</c> and here, and a test asserts each one.
/// </remarks>
public static class RoomRules
{
    public const int MinParticipants = 2;
    public const int MaxParticipants = 500;
    public const int MaxEarlyJoinMinutes = 120;

    /// <summary>
    /// The media-server room name: <c>ceo-</c> plus 8 hex characters.
    /// </summary>
    /// <remarks>
    /// The prefix is load-bearing. A join token is scoped to a room <i>name</i> and nothing else, so an
    /// unprefixed name is one configuration change away from colliding with another product's meeting
    /// on a shared server.
    /// </remarks>
    public static string NewSlug() => "ceo-" + Convert.ToHexString(RandomNumberGenerator.GetBytes(4)).ToLowerInvariant();

    /// <summary>
    /// The secret half of a join link: 32 hex characters from a cryptographic source.
    /// </summary>
    /// <remarks>
    /// Never the row id. A link is handed to people outside the organisation, so it must reveal nothing
    /// and must be replaceable — regenerating this is the only way to kill a link that was forwarded to
    /// the wrong audience.
    /// </remarks>
    public static string NewJoinToken() => Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant();

    /// <summary>Whether this combination of type and join mode is allowed, and why not.</summary>
    /// <returns>Null when the shape is valid; otherwise the Persian reason.</returns>
    public static string? Validate(RoomType type, RoomJoinMode joinMode, string? presenterUserId)
    {
        // A public link into an equal-footing meeting would let a stranger switch a camera on in a
        // committee room. In a presentation the audience token carries canPublish:false.
        if (joinMode == RoomJoinMode.Public && type != RoomType.Presentation)
        {
            return "لینک عمومی فقط برای «ارائه» امکان‌پذیر است. برای جلسه، دعوت‌نامه یا ورود با کد ملی را انتخاب کنید.";
        }

        // Invites belong to meetings; a presentation is reached by link. Two gates disagreeing with
        // each other is worse than either one alone.
        if (joinMode == RoomJoinMode.InviteOnly && type != RoomType.Meeting)
        {
            return "«فقط دعوت‌شدگان» فقط برای جلسه امکان‌پذیر است. برای ارائه، نوع ورود عمومی یا با کد ملی را انتخاب کنید.";
        }

        // A presentation with nobody allowed to speak is a room where nothing happens.
        if (type == RoomType.Presentation && string.IsNullOrWhiteSpace(presenterUserId))
        {
            return "برای ارائه، انتخاب ارائه‌دهنده الزامی است.";
        }

        return null;
    }

    /// <summary>Whether a join link is part of this join mode.</summary>
    public static bool NeedsJoinToken(RoomJoinMode joinMode) => joinMode != RoomJoinMode.InviteOnly;

    /// <summary>Whether an invite list is part of this join mode.</summary>
    public static bool UsesInvites(RoomJoinMode joinMode) => joinMode == RoomJoinMode.InviteOnly;
}
