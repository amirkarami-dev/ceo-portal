using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Rooms;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Rooms;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Rooms;

/// <summary>
/// What the link landing page shows a stranger, before they are let in.
/// </summary>
/// <remarks>
/// <b>No identifiers of any kind.</b> No room id, no slug, no invite list, no presenter کد ملی. Whoever
/// asks for this has done nothing but hold a link, and may still be refused at the next step — so this
/// carries only what a waiting room needs to display: what the meeting is, who is speaking, when it
/// opens, and what will be asked of them.
/// </remarks>
public sealed record RoomLandingDto(
    string Name,
    string? Description,
    RoomType Type,
    RoomJoinMode JoinMode,
    string? PresenterName,
    DateTimeOffset StartsAtUtc,
    /// <summary>When the doors open — start time minus the early-join grace. What the countdown targets.</summary>
    DateTimeOffset OpensAtUtc,
    int? DurationMinutes,
    /// <summary>The server's clock, so a device with the wrong time still counts down correctly.</summary>
    DateTimeOffset ServerNowUtc,
    /// <summary>True when this caller could join right now.</summary>
    bool CanJoinNow,
    /// <summary>True when the visitor must sign in with کد ملی first.</summary>
    bool RequiresSignIn,
    /// <summary>True when a public link is waiting for a typed name.</summary>
    bool RequiresName,
    /// <summary>Why not, in Persian. Empty when <see cref="CanJoinNow"/>.</summary>
    string DenyMessage);

/// <summary>
/// The link landing page. Anonymous by necessity — the visitor has a link and nothing else.
/// </summary>
/// <remarks>
/// This must answer for a meeting that has not started yet, because that is the whole point: the page
/// shows a countdown and enables its own button when the countdown ends. So "too early" is a normal
/// answer here, not an error.
/// </remarks>
public record GetRoomLandingQuery(string JoinToken) : IRequest<RoomLandingDto>;

public class GetRoomLandingQueryHandler(
    IApplicationDbContext context,
    IUser user,
    IRoomJoiner joiner,
    TimeProvider clock) : IRequestHandler<GetRoomLandingQuery, RoomLandingDto>
{
    public async Task<RoomLandingDto> Handle(
        GetRoomLandingQuery request, CancellationToken cancellationToken)
    {
        var room = await RoomLinks.FindAsync(context, request.JoinToken, cancellationToken);

        // A dead link and a link that never existed answer identically. Anything else confirms to a
        // stranger that the link was once real.
        if (room is null)
        {
            throw new Ardalis.GuardClauses.NotFoundException(
                RoomJoinRules.Message(JoinDenyReason.NotFound), nameof(Room));
        }

        var reason = await joiner.PeekAsync(room, cancellationToken);
        var signedIn = !string.IsNullOrWhiteSpace(user.Name) || !string.IsNullOrWhiteSpace(user.Id);

        return new RoomLandingDto(
            room.Name,
            room.Description,
            room.Type,
            room.JoinMode,
            room.PresenterName,
            room.StartsAtUtc,
            room.OpensAtUtc,
            room.DurationMinutes,
            clock.GetUtcNow(),
            CanJoinNow: reason == JoinDenyReason.None,
            RequiresSignIn: reason == JoinDenyReason.NeedsSignIn,

            // Not a refusal — a public link always asks for a name, including while the countdown is
            // still running, so the box can be filled in before the button lights up.
            RequiresName: !signedIn && room.JoinMode == RoomJoinMode.Public,
            DenyMessage: RoomJoinRules.Message(reason));
    }
}

/// <summary>Finds a meeting by the secret half of its link.</summary>
internal static class RoomLinks
{
    /// <summary>
    /// Null for an unknown, empty, or deleted link.
    /// </summary>
    /// <remarks>
    /// Deleting a meeting already clears its token, so a deleted row cannot match — the explicit
    /// <c>!IsDeleted</c> is belt and braces for any row that predates that rule.
    /// </remarks>
    public static async Task<Room?> FindAsync(
        IApplicationDbContext context, string? joinToken, CancellationToken cancellationToken)
    {
        var token = joinToken?.Trim();

        if (string.IsNullOrEmpty(token))
        {
            return null;
        }

        return await context.Rooms
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.JoinToken == token && !r.IsDeleted, cancellationToken);
    }
}

// ── my meetings ──────────────────────────────────────────────────────────────

/// <summary>One row on the attendee's list. Carries no link and no invite list.</summary>
public sealed record MyRoomDto(
    int Id,
    string Name,
    string? Description,
    RoomType Type,
    RoomJoinMode JoinMode,
    string? PresenterName,
    DateTimeOffset StartsAtUtc,
    DateTimeOffset OpensAtUtc,
    int? DurationMinutes,
    int LiveCount,
    bool CanJoinNow,
    /// <summary>True when this person is the one who may speak.</summary>
    bool IsPresenter);

/// <summary>
/// Meetings this person may attend: ones they were invited to, and any they are presenting.
/// </summary>
/// <remarks>
/// Administrators see everything, because they can enter any meeting anyway — hiding rows from them
/// would only mean the list disagreed with what the join endpoint would allow.
/// </remarks>
[Authorize]
public record GetMyRoomsQuery : IRequest<IReadOnlyList<MyRoomDto>>;

public class GetMyRoomsQueryHandler(
    IApplicationDbContext context,
    IUser user,
    ILiveKitAdmin liveKit,
    TimeProvider clock) : IRequestHandler<GetMyRoomsQuery, IReadOnlyList<MyRoomDto>>
{
    public async Task<IReadOnlyList<MyRoomDto>> Handle(
        GetMyRoomsQuery request, CancellationToken cancellationToken)
    {
        var identity = string.IsNullOrWhiteSpace(user.Name) ? user.Id : user.Name;

        if (string.IsNullOrWhiteSpace(identity))
        {
            return [];
        }

        var isAdministrator = Roles.HasAdminPowers(user.Roles);

        var rooms = await context.Rooms
            .AsNoTracking()
            .Where(r => !r.IsDeleted && r.IsActive)
            .Where(r => isAdministrator
                        || r.PresenterUserId == identity
                        || r.Invites.Any(i => i.UserId == identity))
            .OrderBy(r => r.StartsAtUtc)
            .Take(200)
            .ToListAsync(cancellationToken);

        // One call for the whole page. Fail-soft, so an unreachable media server shows zeros rather
        // than turning the list into an error.
        var counts = await liveKit.LiveCountsAsync(rooms.Select(r => r.Slug), cancellationToken);
        var now = clock.GetUtcNow();

        return rooms.Select(r => new MyRoomDto(
                r.Id,
                r.Name,
                r.Description,
                r.Type,
                r.JoinMode,
                r.PresenterName,
                r.StartsAtUtc,
                r.OpensAtUtc,
                r.DurationMinutes,
                counts.TryGetValue(r.Slug, out var n) ? n : 0,
                CanJoinNow: r.IsOpenAt(now),
                IsPresenter: r.MayPublish(identity) && r.Type == RoomType.Presentation))
            .ToList();
    }
}

// ── one meeting, as an attendee sees it ──────────────────────────────────────

/// <summary>
/// What one attendee may see about a meeting they can reach by id.
/// </summary>
/// <remarks>
/// Separate from <c>RoomDetailDto</c> on purpose: that one carries the join link and the invite list,
/// and it must stay unreachable from anything an attendee can call. Two DTOs is the point — one shape
/// with a flag would be one wrong branch away from handing the link out.
/// </remarks>
public sealed record RoomAttendeeDto(
    int Id,
    string Name,
    string? Description,
    RoomType Type,
    RoomJoinMode JoinMode,
    string? PresenterName,
    DateTimeOffset StartsAtUtc,
    DateTimeOffset OpensAtUtc,
    int? DurationMinutes,
    DateTimeOffset ServerNowUtc,
    int LiveCount,
    bool CanJoinNow,
    bool IsPresenter,
    /// <summary>Why not, in Persian. Empty when <see cref="CanJoinNow"/>.</summary>
    string DenyMessage);

[Authorize]
public record GetRoomAttendeeQuery(int Id) : IRequest<RoomAttendeeDto>;

public class GetRoomAttendeeQueryHandler(
    IApplicationDbContext context,
    IUser user,
    IRoomJoiner joiner,
    ILiveKitAdmin liveKit,
    TimeProvider clock) : IRequestHandler<GetRoomAttendeeQuery, RoomAttendeeDto>
{
    public async Task<RoomAttendeeDto> Handle(
        GetRoomAttendeeQuery request, CancellationToken cancellationToken)
    {
        var room = await context.Rooms
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == request.Id && !r.IsDeleted, cancellationToken);

        var reason = await joiner.PeekAsync(room, cancellationToken);

        // Anything short of "you may come in" is answered as not-found. Otherwise this route reports
        // whether a given id is a real meeting to anybody with an account, which is a list of every
        // meeting in the organisation, one id at a time.
        if (room is null
            || reason is JoinDenyReason.NotFound or JoinDenyReason.NotInvited or JoinDenyReason.NeedsSignIn)
        {
            throw new Ardalis.GuardClauses.NotFoundException(
                RoomJoinRules.Message(JoinDenyReason.NotFound), nameof(Room));
        }

        var identity = string.IsNullOrWhiteSpace(user.Name) ? user.Id : user.Name;

        return new RoomAttendeeDto(
            room.Id,
            room.Name,
            room.Description,
            room.Type,
            room.JoinMode,
            room.PresenterName,
            room.StartsAtUtc,
            room.OpensAtUtc,
            room.DurationMinutes,
            clock.GetUtcNow(),
            await liveKit.LiveCountAsync(room.Slug, cancellationToken),
            CanJoinNow: reason == JoinDenyReason.None,
            IsPresenter: room.Type == RoomType.Presentation && room.MayPublish(identity),
            DenyMessage: RoomJoinRules.Message(reason));
    }
}
