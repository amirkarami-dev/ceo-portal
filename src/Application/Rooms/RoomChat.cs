using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Rooms;
using Mabhas19.Domain.Rooms;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Rooms;

public sealed record RoomMessageDto(
    int Id,
    string SenderId,
    string SenderName,
    /// <summary>True when the sender came in through a link and has no account.</summary>
    bool IsGuest,
    string Text,
    DateTimeOffset SentAtUtc);

/// <summary>Who is writing or reading, resolved by the server and never taken from the request.</summary>
internal sealed record ChatWriter(string SenderId, string SenderName, bool IsGuest);

/// <summary>
/// Decides whether a caller may read or write a meeting's chat.
/// </summary>
/// <remarks>
/// <para>
/// Two kinds of caller reach this, and neither is trusted to say who they are.
/// </para>
/// <para>
/// A <b>member</b> arrives with an ordinary bearer token, and must still pass the same join gates as
/// the door — otherwise «not invited» would keep somebody out of the meeting while letting them read
/// everything said in it.
/// </para>
/// <para>
/// A <b>guest</b> has no account at all; that is the feature. What they do have is the media token we
/// signed for them, which binds one identity to one room and expires. So it is verified here and used
/// as the credential. The room in the token is checked against the room being written to — a token is
/// valid for exactly one meeting, and skipping that would let a token from any room post into any
/// other.
/// </para>
/// </remarks>
internal static class RoomChatAccess
{
    public static async Task<ChatWriter> ResolveAsync(
        Room? room,
        string? roomToken,
        IUser user,
        IRoomTokenService tokens,
        IRoomJoiner joiner,
        CancellationToken cancellationToken)
    {
        if (room is null)
        {
            throw new NotFoundException(
                RoomJoinRules.Message(JoinDenyReason.NotFound), nameof(Room));
        }

        var identity = string.IsNullOrWhiteSpace(user.Name) ? user.Id : user.Name;

        if (!string.IsNullOrWhiteSpace(identity))
        {
            // A member. The same gate as joining — reading the chat is being in the meeting.
            var reason = await joiner.PeekAsync(room, cancellationToken);

            if (reason is JoinDenyReason.NotFound or JoinDenyReason.NotInvited or JoinDenyReason.NeedsSignIn)
            {
                throw new NotFoundException(
                    RoomJoinRules.Message(JoinDenyReason.NotFound), nameof(Room));
            }

            var name = RoomJoinRules.SanitizeDisplayName(user.Name);
            return new ChatWriter(identity!, string.IsNullOrEmpty(name) ? identity! : name, IsGuest: false);
        }

        var verified = tokens.VerifyJoinToken(roomToken);

        // Not signed in and no valid token: a 401, because signing in is a thing the browser can fix.
        if (verified is null)
        {
            throw new UnauthorizedAccessException(RoomJoinRules.Message(JoinDenyReason.NeedsSignIn));
        }

        // The token names a room. It must be THIS room.
        if (!string.Equals(verified.RoomName, room.Slug, StringComparison.Ordinal))
        {
            throw new NotFoundException(
                RoomJoinRules.Message(JoinDenyReason.NotFound), nameof(Room));
        }

        // The display name comes out of our own signature, so a guest cannot rename themselves per
        // message — and IsGuest is decided by the identity shape the server minted, never by a field.
        return new ChatWriter(
            verified.Identity,
            RoomJoinRules.SanitizeDisplayName(verified.DisplayName),
            IsGuest: RoomJoinRules.IsGuest(verified.Identity));
    }

    public static async Task<Room?> FindAsync(
        IApplicationDbContext context, int roomId, CancellationToken cancellationToken)
        => await context.Rooms
            .AsNoTracking()
            .FirstOrDefaultAsync(r => r.Id == roomId && !r.IsDeleted, cancellationToken);
}

// ── reading ──────────────────────────────────────────────────────────────────

/// <summary>
/// The chat history for one meeting.
/// </summary>
/// <remarks>
/// Deliberately not <c>[Authorize]</c>: a guest has no account, and the token they carry is the
/// credential. Every gate still runs — see <see cref="RoomChatAccess"/>.
/// </remarks>
public record GetRoomMessagesQuery(int RoomId, string? RoomToken, int Take = 100)
    : IRequest<IReadOnlyList<RoomMessageDto>>;

public class GetRoomMessagesQueryHandler(
    IApplicationDbContext context,
    IUser user,
    IRoomTokenService tokens,
    IRoomJoiner joiner) : IRequestHandler<GetRoomMessagesQuery, IReadOnlyList<RoomMessageDto>>
{
    public async Task<IReadOnlyList<RoomMessageDto>> Handle(
        GetRoomMessagesQuery request, CancellationToken cancellationToken)
    {
        var room = await RoomChatAccess.FindAsync(context, request.RoomId, cancellationToken);

        await RoomChatAccess.ResolveAsync(room, request.RoomToken, user, tokens, joiner, cancellationToken);

        var take = Math.Clamp(request.Take, 1, RoomChatRules.MaxPageSize);

        // Newest first out of the database so the index does the work, then flipped: a chat reads
        // oldest at the top, and taking the FIRST 100 of a long meeting would show the opening
        // pleasantries instead of what was just said.
        var rows = await context.RoomMessages
            .AsNoTracking()
            .Where(m => m.RoomId == request.RoomId)
            .OrderByDescending(m => m.Id)
            .Take(take)
            .ToListAsync(cancellationToken);

        return rows
            .OrderBy(m => m.Id)
            .Select(m => new RoomMessageDto(m.Id, m.SenderId, m.SenderName, m.IsGuest, m.Text, m.Created))
            .ToList();
    }
}

// ── writing ──────────────────────────────────────────────────────────────────

public record SendRoomMessageCommand(int RoomId, string? RoomToken, string Text)
    : IRequest<RoomMessageDto>;

public class SendRoomMessageCommandHandler(
    IApplicationDbContext context,
    IUser user,
    IRoomTokenService tokens,
    IRoomJoiner joiner) : IRequestHandler<SendRoomMessageCommand, RoomMessageDto>
{
    public async Task<RoomMessageDto> Handle(
        SendRoomMessageCommand request, CancellationToken cancellationToken)
    {
        var room = await RoomChatAccess.FindAsync(context, request.RoomId, cancellationToken);

        var writer = await RoomChatAccess.ResolveAsync(
            room, request.RoomToken, user, tokens, joiner, cancellationToken);

        // A meeting an admin closed stops taking messages. Reading what was already said still works —
        // closing the doors is not deleting the record.
        if (room!.IsActive == false)
        {
            throw RoomGuard.Invalid("Text", RoomJoinRules.Message(JoinDenyReason.Closed));
        }

        var text = RoomChatRules.Clean(request.Text);

        if (text.Length == 0)
        {
            throw RoomGuard.Invalid("Text", "پیام خالی است");
        }

        var message = new RoomMessage
        {
            RoomId = room.Id,
            SenderId = writer.SenderId,
            SenderName = string.IsNullOrWhiteSpace(writer.SenderName) ? "مهمان" : writer.SenderName,
            IsGuest = writer.IsGuest,
            Text = text,
        };

        context.RoomMessages.Add(message);
        await context.SaveChangesAsync(cancellationToken);

        return new RoomMessageDto(
            message.Id, message.SenderId, message.SenderName, message.IsGuest, message.Text,
            message.Created);
    }
}

/// <summary>Shape rules for a chat line. No database, no clock.</summary>
public static class RoomChatRules
{
    /// <summary>Matches the column. Anything longer is cut rather than refused.</summary>
    public const int MaxLength = 4000;

    public const int MaxPageSize = 200;

    /// <summary>
    /// Trims a message and strips what must never reach another participant's screen.
    /// </summary>
    /// <remarks>
    /// The same reasoning as a display name, and for the same reason it happens here rather than at
    /// render time: this text goes to the database and comes back to every other client, including
    /// ones we did not write. Bidirectional overrides can reverse the rendering of everything after
    /// them, so one message could scramble the whole transcript for everybody.
    ///
    /// Line breaks ARE kept — a chat message is allowed to have paragraphs, unlike a name.
    /// </remarks>
    public static string Clean(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return string.Empty;
        }

        var sb = new System.Text.StringBuilder(text.Length);

        foreach (var rune in text.EnumerateRunes())
        {
            if (rune.Value is '\n' or '\r' or '\t')
            {
                sb.Append(rune.Value == '\t' ? ' ' : (char)rune.Value);
                continue;
            }

            // U+200C/U+200D are the Persian نیم‌فاصله and the joiner — ordinary parts of written
            // Persian, and stripping them would respell people's words. See GOTCHAS.
            if (rune.Value is 0x200C or 0x200D)
            {
                sb.Append(rune);
                continue;
            }

            var category = System.Globalization.CharUnicodeInfo.GetUnicodeCategory(rune.Value);
            if (category is System.Globalization.UnicodeCategory.Control
                or System.Globalization.UnicodeCategory.Format
                or System.Globalization.UnicodeCategory.Surrogate
                or System.Globalization.UnicodeCategory.PrivateUse
                or System.Globalization.UnicodeCategory.OtherNotAssigned)
            {
                continue;
            }

            sb.Append(rune);
        }

        var cleaned = sb.ToString().Trim();
        return cleaned.Length > MaxLength ? cleaned[..MaxLength] : cleaned;
    }
}
