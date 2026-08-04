using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Rooms;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Rooms;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Rooms;

public sealed record RoomListItemDto(
    int Id,
    string Name,
    string? Description,
    RoomType Type,
    RoomJoinMode JoinMode,
    string DateJalali,
    TimeOnly StartTime,
    DateTimeOffset StartsAtUtc,
    DateTimeOffset OpensAtUtc,
    int? DurationMinutes,
    int MaxParticipants,
    string? PresenterName,
    bool IsActive,
    /// <summary>How many people are inside right now. 0 when the media server is unreachable.</summary>
    int LiveCount,
    int InviteCount,
    /// <summary>
    /// The full join link, ready to copy. Null for an invite-only meeting.
    /// </summary>
    /// <remarks>
    /// Administrator-only, which is why it is on this DTO and not the attendee one. Anyone holding it
    /// can open the join page — that is the whole point of it — so it must never reach a non-admin
    /// response.
    /// </remarks>
    string? JoinUrl);

public sealed record RoomInviteDto(string UserId, string? UserName);

public sealed record RoomDetailDto(
    int Id,
    string Name,
    string? Description,
    RoomType Type,
    RoomJoinMode JoinMode,
    string DateJalali,
    TimeOnly StartTime,
    DateTimeOffset StartsAtUtc,
    int EarlyJoinMinutes,
    int? DurationMinutes,
    int MaxParticipants,
    string? PresenterUserId,
    string? PresenterName,
    bool IsActive,
    string Slug,
    string? JoinUrl,
    int LiveCount,
    IReadOnlyList<RoomInviteDto> Invites);

/// <summary>
/// Builds the link an attendee opens.
/// </summary>
/// <remarks>
/// The front-end base is configuration rather than something the API derives from the request, so a
/// link is the same whether it was created from the admin panel, a script, or a request that arrived
/// through the CDN with a rewritten host.
/// </remarks>
public sealed class RoomLinkOptions
{
    public const string SectionName = "Rooms";

    /// <summary>e.g. <c>https://room.myceo.ir</c>.</summary>
    public string PublicBaseUrl { get; init; } = string.Empty;

    public string? BuildJoinUrl(string? joinToken) =>
        string.IsNullOrWhiteSpace(joinToken) || string.IsNullOrWhiteSpace(PublicBaseUrl)
            ? null
            : $"{PublicBaseUrl.TrimEnd('/')}/j/{joinToken}";
}

// ── list ─────────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record GetRoomsQuery : IRequest<IReadOnlyList<RoomListItemDto>>;

public class GetRoomsQueryHandler(
    IApplicationDbContext context,
    ILiveKitAdmin liveKit,
    Microsoft.Extensions.Options.IOptions<RoomLinkOptions> links)
    : IRequestHandler<GetRoomsQuery, IReadOnlyList<RoomListItemDto>>
{
    public async Task<IReadOnlyList<RoomListItemDto>> Handle(
        GetRoomsQuery request,
        CancellationToken cancellationToken)
    {
        var rooms = await context.Rooms
            .AsNoTracking()
            .Where(r => !r.IsDeleted)
            .OrderByDescending(r => r.StartsAtUtc)
            .Select(r => new
            {
                Room = r,
                InviteCount = r.Invites.Count,
            })
            .Take(200)
            .ToListAsync(cancellationToken);

        // One call for the whole page, not one per row to another machine. Fail-soft: an unreachable
        // media server yields zeros and the list still renders.
        var counts = await liveKit.LiveCountsAsync(
            rooms.Select(r => r.Room.Slug), cancellationToken);

        var options = links.Value;

        return rooms.Select(r => new RoomListItemDto(
                r.Room.Id,
                r.Room.Name,
                r.Room.Description,
                r.Room.Type,
                r.Room.JoinMode,
                r.Room.DateJalaliOf(),
                TimeOnly.FromTimeSpan(r.Room.StartsAtUtc.ToOffset(Common.IranTime.Offset).TimeOfDay),
                r.Room.StartsAtUtc,
                r.Room.OpensAtUtc,
                r.Room.DurationMinutes,
                r.Room.MaxParticipants,
                r.Room.PresenterName,
                r.Room.IsActive,
                counts.TryGetValue(r.Room.Slug, out var n) ? n : 0,
                r.InviteCount,
                options.BuildJoinUrl(r.Room.JoinToken)))
            .ToList();
    }
}

// ── detail ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record GetRoomQuery(int Id) : IRequest<RoomDetailDto>;

public class GetRoomQueryHandler(
    IApplicationDbContext context,
    ILiveKitAdmin liveKit,
    Microsoft.Extensions.Options.IOptions<RoomLinkOptions> links)
    : IRequestHandler<GetRoomQuery, RoomDetailDto>
{
    public async Task<RoomDetailDto> Handle(GetRoomQuery request, CancellationToken cancellationToken)
    {
        var room = await context.Rooms
            .AsNoTracking()
            .Include(r => r.Invites)
            .FirstOrDefaultAsync(r => r.Id == request.Id && !r.IsDeleted, cancellationToken);

        Guard.Against.NotFound(request.Id, room);

        var live = await liveKit.LiveCountAsync(room.Slug, cancellationToken);

        return new RoomDetailDto(
            room.Id,
            room.Name,
            room.Description,
            room.Type,
            room.JoinMode,
            room.DateJalaliOf(),
            TimeOnly.FromTimeSpan(room.StartsAtUtc.ToOffset(Common.IranTime.Offset).TimeOfDay),
            room.StartsAtUtc,
            room.EarlyJoinMinutes,
            room.DurationMinutes,
            room.MaxParticipants,
            room.PresenterUserId,
            room.PresenterName,
            room.IsActive,
            room.Slug,
            links.Value.BuildJoinUrl(room.JoinToken),
            live,
            room.Invites
                .OrderBy(i => i.UserName)
                .Select(i => new RoomInviteDto(i.UserId, i.UserName))
                .ToList());
    }
}

// ── looking a person up ──────────────────────────────────────────────────────

public sealed record RoomPersonDto(string NationalCode, string FullName);

/// <summary>
/// Resolves a کد ملی to the name the organisation has on file.
/// </summary>
/// <remarks>
/// <para>
/// Exists so the admin panel can show «آزمون مهندس» while the code is being typed. Without it, the
/// presenter box and the invite box are a ten-digit field that only tells you it was wrong after a
/// save — and the API refuses anything that is not a real کد ملی, so that would be a slow way to
/// discover a typo.
/// </para>
/// <para>
/// Administrator-only, and it answers a name and nothing else. It is the same lookup an invite already
/// performs, so it reveals nothing the admin could not learn by inviting the person; but it is worth
/// stating that it must never grow a route that goes the other way — searching by name would turn it
/// into a downloadable membership list.
/// </para>
/// </remarks>
[Authorize(Roles = Roles.AdminOrSuper)]
public record LookupRoomPersonQuery(string NationalCode) : IRequest<RoomPersonDto>;

public class LookupRoomPersonQueryHandler(IEngineerDirectory directory)
    : IRequestHandler<LookupRoomPersonQuery, RoomPersonDto>
{
    public async Task<RoomPersonDto> Handle(
        LookupRoomPersonQuery request, CancellationToken cancellationToken)
    {
        var code = Common.JalaliDate.NormalizeDigits(request.NationalCode ?? string.Empty).Trim();

        // The same helper the presenter and the invite path use, so the three cannot answer
        // differently about the same person — including telling an outage apart from "not found".
        var name = await RoomPeople.ResolveNameAsync(
            directory, code, nameof(LookupRoomPersonQuery.NationalCode), cancellationToken);

        return new RoomPersonDto(code, name ?? string.Empty);
    }
}

internal static class RoomDateExtensions
{
    /// <summary>
    /// The start date as the admin entered it.
    /// </summary>
    /// <remarks>
    /// Derived from the stored instant rather than kept as a second column: one source of truth means
    /// the displayed date can never drift from the time the meeting actually opens.
    /// </remarks>
    public static string DateJalaliOf(this Room room)
        => Common.JalaliDate.Format(
            DateOnly.FromDateTime(room.StartsAtUtc.ToOffset(Common.IranTime.Offset).DateTime));
}
