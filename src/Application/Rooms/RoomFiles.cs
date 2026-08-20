using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Rooms;
using Mabhas19.Domain.Rooms;

namespace Mabhas19.Application.Rooms;

/// <summary>
/// One file attached to a meeting, as the panel shows it.
/// </summary>
/// <remarks>
/// <b>No uploader field.</b> The row records <c>CreatedBy</c>, but for an engineer account that
/// identity IS their کد ملی (the IdP uses it as the login name), so putting it on a DTO the whole
/// audience can read would publish the presenter's national code. Who runs the meeting is already
/// known from the meeting itself.
/// </remarks>
public sealed record RoomFileDto(
    int Id,
    string FileName,
    string ContentType,
    long SizeBytes,
    DateTimeOffset UploadedAtUtc);

/// <summary>What the API needs to stream one file back. Never leaves the server as JSON.</summary>
public sealed record RoomFileDownloadDto(string StoredKey, string FileName, string ContentType);

/// <summary>Shape rules for a meeting's files. No database, no clock.</summary>
public static class RoomFileRules
{
    /// <summary>An agenda, a slide deck or a scanned form. Not a video.</summary>
    public const long MaxFileBytes = 20L * 1024 * 1024;

    /// <summary>Per meeting. A handout list longer than this is a shared drive, not a meeting.</summary>
    public const int MaxFilesPerRoom = 10;

    /// <summary>
    /// The object key. The uploader's name is NEVER part of it: it is caller-controlled text that
    /// would otherwise decide a storage path, and two people uploading «سند.pdf» must not collide.
    /// The real name is kept in the row and used only when handing the file back.
    /// </summary>
    public static string KeyFor(int roomId, string fileName)
    {
        var extension = Path.GetExtension(fileName);

        // The extension comes from that same untrusted string, so it is bounded too.
        if (extension.Length > 12 || extension.Any(c => !char.IsLetterOrDigit(c) && c != '.'))
        {
            extension = string.Empty;
        }

        return $"rooms/{roomId}/{Guid.NewGuid():N}{extension}";
    }
}

/// <summary>
/// One uploaded part, as the Application layer sees it.
/// </summary>
/// <remarks>
/// Exists so this layer never references <c>IFormFile</c> — the same reason
/// <c>IKurdnezamFormUpload</c> exists. The Web layer adapts the real request.
/// </remarks>
public interface IRoomFileUpload
{
    string FileName { get; }

    string ContentType { get; }

    long SizeBytes { get; }

    Stream OpenRead();
}

// ── reading ──────────────────────────────────────────────────────────────────

/// <summary>
/// The files attached to a meeting, newest first.
/// </summary>
/// <remarks>
/// Readable by anyone who may be in the meeting — the audience is who the handouts are for. The gate
/// is <c>RoomChatAccess.ResolveAsync</c>, the same one the chat and the board use, so a guest on a
/// signed join token is admitted exactly as they are there. It deliberately does not refuse a meeting
/// that has not started or has already finished: the files outlive the meeting, which is the point.
/// </remarks>
public record GetRoomFilesQuery(int RoomId, string? RoomToken) : IRequest<IReadOnlyList<RoomFileDto>>;

public class GetRoomFilesQueryHandler(
    IApplicationDbContext context,
    IUser user,
    IRoomTokenService tokens,
    IRoomJoiner joiner) : IRequestHandler<GetRoomFilesQuery, IReadOnlyList<RoomFileDto>>
{
    public async Task<IReadOnlyList<RoomFileDto>> Handle(
        GetRoomFilesQuery request, CancellationToken cancellationToken)
    {
        var room = await RoomChatAccess.FindAsync(context, request.RoomId, cancellationToken);

        await RoomChatAccess.ResolveAsync(room, request.RoomToken, user, tokens, joiner, cancellationToken);

        return await context.RoomFiles
            .AsNoTracking()
            .Where(f => f.RoomId == request.RoomId)
            .OrderByDescending(f => f.Created)
            .ThenByDescending(f => f.Id)
            .Select(f => new RoomFileDto(f.Id, f.FileName, f.ContentType, f.SizeBytes, f.Created))
            .ToListAsync(cancellationToken);
    }
}

/// <summary>
/// Resolves one file for download, after checking the caller may be in its meeting.
/// </summary>
/// <remarks>
/// Returns the key rather than the bytes: streaming belongs at the Web layer, which owns the
/// response. The key itself never reaches a browser.
/// </remarks>
public record GetRoomFileForDownloadQuery(int FileId, string? RoomToken) : IRequest<RoomFileDownloadDto>;

public class GetRoomFileForDownloadQueryHandler(
    IApplicationDbContext context,
    IUser user,
    IRoomTokenService tokens,
    IRoomJoiner joiner) : IRequestHandler<GetRoomFileForDownloadQuery, RoomFileDownloadDto>
{
    public async Task<RoomFileDownloadDto> Handle(
        GetRoomFileForDownloadQuery request, CancellationToken cancellationToken)
    {
        var file = await context.RoomFiles
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == request.FileId, cancellationToken);

        Guard.Against.NotFound(request.FileId, file);

        var room = await RoomChatAccess.FindAsync(context, file.RoomId, cancellationToken);

        await RoomChatAccess.ResolveAsync(room, request.RoomToken, user, tokens, joiner, cancellationToken);

        return new RoomFileDownloadDto(file.StoredKey, file.FileName, file.ContentType);
    }
}

// ── writing ──────────────────────────────────────────────────────────────────

/// <summary>
/// Attaches one file to a meeting.
/// </summary>
/// <remarks>
/// <b>The gate is <see cref="Room.MayPublish"/></b> — the same predicate that decides the microphone
/// and the pen. In a presentation that is the presenter alone; in a meeting everyone is equal and so
/// may add a handout. Keeping all three on one predicate is what stops them drifting apart.
/// </remarks>
public record UploadRoomFileCommand(int RoomId, string? RoomToken, IRoomFileUpload File) : IRequest<int>;

public class UploadRoomFileCommandHandler(
    IApplicationDbContext context,
    IUser user,
    IFileStorage storage,
    IRoomTokenService tokens,
    IRoomJoiner joiner) : IRequestHandler<UploadRoomFileCommand, int>
{
    public async Task<int> Handle(UploadRoomFileCommand request, CancellationToken cancellationToken)
    {
        var room = await RoomChatAccess.FindAsync(context, request.RoomId, cancellationToken);

        var writer = await RoomChatAccess.ResolveAsync(
            room, request.RoomToken, user, tokens, joiner, cancellationToken);

        // Closing a meeting stops it taking new work; its files stay readable. Same rule as the board.
        if (!room!.IsActive)
        {
            throw RoomGuard.Invalid("File", RoomJoinRules.Message(JoinDenyReason.Closed));
        }

        if (!room.MayPublish(writer.SenderId))
        {
            throw RoomGuard.Invalid("File", "در این ارائه فقط ارائه‌دهنده می‌تواند فایل اضافه کند");
        }

        var upload = request.File;

        if (string.IsNullOrWhiteSpace(upload.FileName))
        {
            throw RoomGuard.Invalid("File", "نام فایل مشخص نیست");
        }

        if (upload.SizeBytes <= 0)
        {
            throw RoomGuard.Invalid("File", "فایل خالی است");
        }

        if (upload.SizeBytes > RoomFileRules.MaxFileBytes)
        {
            throw RoomGuard.Invalid("File", "حجم فایل بیش از حد مجاز است (حداکثر ۲۰ مگابایت)");
        }

        var count = await context.RoomFiles.CountAsync(f => f.RoomId == room.Id, cancellationToken);

        if (count >= RoomFileRules.MaxFilesPerRoom)
        {
            throw RoomGuard.Invalid(
                "File", "تعداد فایل‌های این جلسه به حد مجاز رسیده است (حداکثر ۱۰ فایل)");
        }

        var key = RoomFileRules.KeyFor(room.Id, upload.FileName);

        await using (var stream = upload.OpenRead())
        {
            await storage.PutAsync(key, stream, upload.ContentType, cancellationToken);
        }

        var entity = new RoomFile
        {
            RoomId = room.Id,
            // Only the name, never a path: some browsers send one, and it is the caller's text.
            FileName = Path.GetFileName(upload.FileName),
            StoredKey = key,
            ContentType = string.IsNullOrWhiteSpace(upload.ContentType)
                ? "application/octet-stream"
                : upload.ContentType,
            SizeBytes = upload.SizeBytes
        };

        context.RoomFiles.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

/// <summary>
/// Removes one file from a meeting, and its bytes from storage.
/// </summary>
/// <remarks>
/// Same gate as uploading. The object is deleted before the row, and a storage failure is tolerated
/// on purpose: an object that is already gone must not leave behind a row nobody can remove. That
/// trades tidiness in a bucket for not creating a dead end on screen.
/// </remarks>
public record DeleteRoomFileCommand(int FileId, string? RoomToken) : IRequest;

public class DeleteRoomFileCommandHandler(
    IApplicationDbContext context,
    IUser user,
    IFileStorage storage,
    IRoomTokenService tokens,
    IRoomJoiner joiner) : IRequestHandler<DeleteRoomFileCommand>
{
    public async Task Handle(DeleteRoomFileCommand request, CancellationToken cancellationToken)
    {
        var file = await context.RoomFiles
            .FirstOrDefaultAsync(f => f.Id == request.FileId, cancellationToken);

        Guard.Against.NotFound(request.FileId, file);

        var room = await RoomChatAccess.FindAsync(context, file.RoomId, cancellationToken);

        var writer = await RoomChatAccess.ResolveAsync(
            room, request.RoomToken, user, tokens, joiner, cancellationToken);

        if (!room!.MayPublish(writer.SenderId))
        {
            throw RoomGuard.Invalid("File", "در این ارائه فقط ارائه‌دهنده می‌تواند فایل حذف کند");
        }

        try
        {
            await storage.DeleteAsync(file.StoredKey, cancellationToken);
        }
        catch (Exception)
        {
            // Already gone, or storage refused. Removing the row is still the right outcome — see
            // the remark above.
        }

        context.RoomFiles.Remove(file);
        await context.SaveChangesAsync(cancellationToken);
    }
}
