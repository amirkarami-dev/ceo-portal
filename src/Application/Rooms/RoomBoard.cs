using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Rooms;
using Mabhas19.Domain.Rooms;

namespace Mabhas19.Application.Rooms;

public sealed record RoomBoardDto(string Scene, DateTimeOffset UpdatedAtUtc);

/// <summary>Shape rules for a saved board. No database, no clock.</summary>
public static class RoomBoardRules
{
    /// <summary>
    /// Roughly a very full board of shapes and text. A pasted photograph is what exceeds it, and that
    /// is the case worth refusing loudly rather than storing.
    /// </summary>
    public const int MaxSceneLength = 2_000_000;
}

// ── reading ──────────────────────────────────────────────────────────────────

/// <summary>
/// The saved whiteboard, or null when nobody has drawn yet.
/// </summary>
/// <remarks>
/// Anonymous like the chat routes, and credentialled the same way: a guest presents the media token we
/// signed for them. Reading is allowed to anyone who may be in the meeting — in a presentation the
/// audience watches the presenter draw, which is the point.
/// </remarks>
public record GetRoomBoardQuery(int RoomId, string? RoomToken) : IRequest<RoomBoardDto?>;

public class GetRoomBoardQueryHandler(
    IApplicationDbContext context,
    IUser user,
    IRoomTokenService tokens,
    IRoomJoiner joiner) : IRequestHandler<GetRoomBoardQuery, RoomBoardDto?>
{
    public async Task<RoomBoardDto?> Handle(GetRoomBoardQuery request, CancellationToken cancellationToken)
    {
        var room = await RoomChatAccess.FindAsync(context, request.RoomId, cancellationToken);

        await RoomChatAccess.ResolveAsync(room, request.RoomToken, user, tokens, joiner, cancellationToken);

        var board = await context.RoomBoards
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.RoomId == request.RoomId, cancellationToken);

        return board is null ? null : new RoomBoardDto(board.Scene, board.LastModified);
    }
}

// ── writing ──────────────────────────────────────────────────────────────────

/// <summary>
/// Replaces the saved board.
/// </summary>
/// <remarks>
/// <para>
/// The whole scene, not a delta: every client has already merged everyone's shapes, so any drawer's
/// copy is a complete and valid board. Last write wins, and that is safe for the same reason.
/// </para>
/// <para>
/// <b>The gate is <see cref="Room.MayPublish"/></b> — the same predicate that decides the microphone.
/// The pen follows the mic, in one place, so the two cannot drift apart. It is enforced here and not
/// only in the browser because every participant's token grants data-channel publishing, audience
/// included: refusing the save is what actually stops a forged edit from lasting.
/// </para>
/// </remarks>
public record SaveRoomBoardCommand(int RoomId, string? RoomToken, string Scene) : IRequest;

public class SaveRoomBoardCommandHandler(
    IApplicationDbContext context,
    IUser user,
    IRoomTokenService tokens,
    IRoomJoiner joiner) : IRequestHandler<SaveRoomBoardCommand>
{
    public async Task Handle(SaveRoomBoardCommand request, CancellationToken cancellationToken)
    {
        var room = await RoomChatAccess.FindAsync(context, request.RoomId, cancellationToken);

        var writer = await RoomChatAccess.ResolveAsync(
            room, request.RoomToken, user, tokens, joiner, cancellationToken);

        // Closing a meeting stops it taking new work. The board stays readable — closing the doors is
        // not deleting the record.
        if (room!.IsActive == false)
        {
            throw RoomGuard.Invalid("Scene", RoomJoinRules.Message(JoinDenyReason.Closed));
        }

        if (!room.MayPublish(writer.SenderId))
        {
            throw RoomGuard.Invalid("Scene", "در این ارائه فقط ارائه‌دهنده می‌تواند روی تخته بنویسد");
        }

        if (string.IsNullOrWhiteSpace(request.Scene))
        {
            throw RoomGuard.Invalid("Scene", "تخته خالی است");
        }

        if (request.Scene.Length > RoomBoardRules.MaxSceneLength)
        {
            throw RoomGuard.Invalid("Scene", "حجم تخته بیش از حد مجاز است");
        }

        var board = await context.RoomBoards
            .FirstOrDefaultAsync(x => x.RoomId == room.Id, cancellationToken);

        if (board is not null)
        {
            board.Scene = request.Scene;
            board.UpdatedBy = writer.SenderId;
            await context.SaveChangesAsync(cancellationToken);
            return;
        }

        var created = new RoomBoard
        {
            RoomId = room.Id,
            Scene = request.Scene,
            UpdatedBy = writer.SenderId,
        };

        context.RoomBoards.Add(created);

        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // Two people drew at the same moment on a board nobody had saved yet, so both read
            // "no board" and both tried to create one. The unique index on RoomId is what turns
            // that into one catchable error instead of two rows for one meeting.
            //
            // Losing the insert is not a conflict to resolve. Last write wins is already this
            // feature's rule — every client holds the same merged scene, so either save is a
            // complete and valid board — which makes the recovery an ordinary update of the row
            // that won.
            //
            // Removing an entity that is still in the Added state detaches it rather than marking
            // it deleted, so the failed insert does not follow us into the retry.
            context.RoomBoards.Remove(created);

            var winner = await context.RoomBoards
                .FirstOrDefaultAsync(x => x.RoomId == room.Id, cancellationToken);

            // No winner means the insert failed for some other reason entirely, and swallowing it
            // would turn a real fault into a silent no-op.
            if (winner is null) throw;

            winner.Scene = request.Scene;
            winner.UpdatedBy = writer.SenderId;
            await context.SaveChangesAsync(cancellationToken);
        }
    }
}
