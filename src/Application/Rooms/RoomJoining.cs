using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Rooms;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Rooms;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Rooms;

/// <summary>Everything a browser needs to connect, once every gate has passed.</summary>
public sealed record RoomJoinDto(
    /// <summary>The meeting, so chat and the participant list have something to key on.</summary>
    int RoomId,
    string RoomName,
    RoomType Type,
    /// <summary>The signed media token. One room, one participant, and it expires.</summary>
    string Token,
    /// <summary>Where the browser opens its socket, e.g. <c>wss://lk.myceo.ir</c>.</summary>
    string WsUrl,
    /// <summary>The identity inside the meeting: کد ملی for a member, <c>guest-…</c> for a link visitor.</summary>
    string Identity,
    string DisplayName,
    /// <summary>
    /// Whether camera, microphone and screen are allowed. The UI hides the buttons when false, but the
    /// media server is what actually refuses — this flag only mirrors what the token already says.
    /// </summary>
    bool CanPublish,
    string? PresenterName);

/// <summary>
/// The single implementation of "let this person in".
/// </summary>
/// <remarks>
/// <para>
/// Both ways into a meeting — a signed-in member opening it from their list, and a stranger opening a
/// link — end here. That is deliberate, and it is the same decision as <c>IBallotCaster</c> on the
/// election side: two entry points that each decide for themselves drift apart, and the drift shows up
/// as one of them letting somebody in that the other would refuse.
/// </para>
/// <para>
/// The caller supplies who is asking. This decides whether they may come in, and mints the token if so.
/// </para>
/// </remarks>
public interface IRoomJoiner
{
    /// <summary>Runs every gate and mints a token, or throws with the Persian reason it refused.</summary>
    /// <param name="room">Already loaded, with <c>Invites</c> included when the mode uses them.</param>
    /// <param name="typedName">Only read for an anonymous visitor to a public link.</param>
    Task<RoomJoinDto> JoinAsync(Room? room, string? typedName, CancellationToken cancellationToken);

    /// <summary>The refusal reason without minting anything — what the landing page shows.</summary>
    Task<JoinDenyReason> PeekAsync(Room? room, CancellationToken cancellationToken);
}

public class RoomJoiner(
    IApplicationDbContext context,
    IUser user,
    IRoomTokenService tokens,
    ILiveKitAdmin liveKit,
    TimeProvider clock) : IRoomJoiner
{
    /// <summary>
    /// The caller's identity inside a meeting, or null when nobody is signed in.
    /// </summary>
    /// <remarks>
    /// The کد ملی when an engineer signed in — that is the username on those accounts, and it is what
    /// <see cref="Room.MayPublish"/> compares the presenter against. A staff account falls back to its
    /// subject, which is equally stable and will never match a کد ملی, so an administrator joins a
    /// presentation as audience. That is the intended answer: only the presenter speaks.
    /// </remarks>
    private string? Identity
    {
        get
        {
            var name = user.Name?.Trim();
            if (!string.IsNullOrEmpty(name))
            {
                return name;
            }

            var id = user.Id?.Trim();
            return string.IsNullOrEmpty(id) ? null : id;
        }
    }

    private bool IsAdministrator => Roles.HasAdminPowers(user.Roles);

    public async Task<JoinDenyReason> PeekAsync(Room? room, CancellationToken cancellationToken)
        => RoomJoinRules.Check(
            room,
            Identity,
            IsAdministrator,
            await IsInvitedAsync(room, cancellationToken),
            // The landing page asks before anything is typed, so a public link must not report
            // "type your name" as though the meeting itself were the problem. A placeholder here
            // keeps the peek about the meeting; the name is checked when they actually press join.
            typedName: "-",
            clock.GetUtcNow(),
            await LiveCountAsync(room, cancellationToken),
            tokens.IsConfigured);

    public async Task<RoomJoinDto> JoinAsync(
        Room? room, string? typedName, CancellationToken cancellationToken)
    {
        var identity = Identity;

        var reason = RoomJoinRules.Check(
            room,
            identity,
            IsAdministrator,
            await IsInvitedAsync(room, cancellationToken),
            typedName,
            clock.GetUtcNow(),
            await LiveCountAsync(room, cancellationToken),
            tokens.IsConfigured);

        if (reason != JoinDenyReason.None)
        {
            throw Refuse(reason);
        }

        // Not null: Check returns NotFound first, so reaching here means the room exists.
        ArgumentNullException.ThrowIfNull(room);

        // A guest identity is minted fresh per join and never derived from the typed name. Two people
        // called «رضا» must be two participants — the media server treats one identity as one person and
        // would disconnect the first when the second arrived.
        var isGuest = identity is null;
        var joinIdentity = identity ?? RoomJoinRules.NewGuestIdentity();

        var displayName = isGuest
            ? RoomJoinRules.SanitizeDisplayName(typedName)
            : RoomJoinRules.SanitizeDisplayName(user.Name);

        if (string.IsNullOrWhiteSpace(displayName))
        {
            displayName = isGuest ? "مهمان" : joinIdentity;
        }

        // Idempotent, and fail-soft: if this cannot reach the media server the token is still valid and
        // the room is created by the first participant to connect.
        await liveKit.EnsureRoomAsync(room.Slug, room.MaxParticipants, cancellationToken);

        // The whole feature, in one argument. A guest identity can never equal PresenterUserId, so a
        // public-link visitor always gets canPublish:false — and the media server, not the UI, is what
        // enforces it.
        var canPublish = room.MayPublish(joinIdentity);

        var token = tokens.CreateJoinToken(
            new RoomGrant(room.Slug, joinIdentity, displayName, canPublish));

        return new RoomJoinDto(
            room.Id,
            room.Name,
            room.Type,
            token,
            tokens.PublicWsUrl,
            joinIdentity,
            displayName,
            canPublish,
            room.PresenterName);
    }

    /// <summary>
    /// Turns a refusal into the exception whose status code the front end can act on.
    /// </summary>
    /// <remarks>
    /// «باید وارد شوید» is a 401 because that is a thing the browser can fix by itself — every other
    /// refusal is a 400 carrying the Persian sentence, because the caller needs to read it. A 403 would
    /// lose the message entirely: the problem-details handler writes no detail for one.
    /// </remarks>
    private static Exception Refuse(JoinDenyReason reason)
    {
        var message = RoomJoinRules.Message(reason);

        return reason switch
        {
            JoinDenyReason.NotFound => new Ardalis.GuardClauses.NotFoundException(message, nameof(Room)),
            JoinDenyReason.NeedsSignIn => new UnauthorizedAccessException(message),
            _ => RoomGuard.Invalid("Join", message)
        };
    }

    private async Task<bool> IsInvitedAsync(Room? room, CancellationToken cancellationToken)
    {
        var identity = Identity;

        if (room is null
            || identity is null
            || !RoomRules.UsesInvites(room.JoinMode))
        {
            return false;
        }

        return await context.RoomInvites
            .AsNoTracking()
            .AnyAsync(i => i.RoomId == room.Id && i.UserId == identity, cancellationToken);
    }

    private async Task<int> LiveCountAsync(Room? room, CancellationToken cancellationToken)
        => room is null ? 0 : await liveKit.LiveCountAsync(room.Slug, cancellationToken);
}
