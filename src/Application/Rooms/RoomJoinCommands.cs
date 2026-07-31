using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Rooms;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Rooms;

/// <summary>
/// Join through a link.
/// </summary>
/// <remarks>
/// <para>
/// Deliberately <b>not</b> <c>[Authorize]</c>: a public presentation is opened by people with no
/// account, and that is the feature. It still works signed in — a private link is exactly this request
/// made with a token, and the handler sees the identity and mints a member token instead of a guest
/// one. So the SPA calls one endpoint before and after signing in.
/// </para>
/// <para>
/// Note what the body does not contain: no room id, no identity, no publish flag. The link decides which
/// meeting, the token decides who, and the meeting's own type decides what they may do. The only thing
/// a caller supplies is a name for themselves, and only when nobody is signed in.
/// </para>
/// </remarks>
public record JoinRoomByLinkCommand(string JoinToken, string? FullName) : IRequest<RoomJoinDto>;

public class JoinRoomByLinkCommandHandler(IApplicationDbContext context, IRoomJoiner joiner)
    : IRequestHandler<JoinRoomByLinkCommand, RoomJoinDto>
{
    public async Task<RoomJoinDto> Handle(
        JoinRoomByLinkCommand request, CancellationToken cancellationToken)
    {
        var room = await RoomLinks.FindAsync(context, request.JoinToken, cancellationToken);

        return await joiner.JoinAsync(room, request.FullName, cancellationToken);
    }
}

/// <summary>
/// Join a meeting from the attendee's own list, by id.
/// </summary>
/// <remarks>
/// This is the invite-only path, where there is no link to hold. The id is not a secret and grants
/// nothing on its own — every gate still runs, so guessing an id gets a stranger the same «دعوت
/// نشده‌اید» that pressing the wrong row would.
/// </remarks>
[Authorize]
public record JoinRoomCommand(int Id) : IRequest<RoomJoinDto>;

public class JoinRoomCommandHandler(IApplicationDbContext context, IRoomJoiner joiner)
    : IRequestHandler<JoinRoomCommand, RoomJoinDto>
{
    public async Task<RoomJoinDto> Handle(JoinRoomCommand request, CancellationToken cancellationToken)
    {
        var room = await context.Rooms
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == request.Id && !r.IsDeleted, cancellationToken);

        // No typed name: a signed-in person's name comes from their account, never from the request.
        return await joiner.JoinAsync(room, typedName: null, cancellationToken);
    }
}
