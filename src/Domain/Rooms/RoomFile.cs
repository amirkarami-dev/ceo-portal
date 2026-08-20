using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Rooms;

/// <summary>
/// One file attached to a meeting — a handout, an agenda, a slide deck. Only the reference is
/// stored here; the bytes live in MinIO, like every other upload in this project.
/// </summary>
/// <remarks>
/// <para>
/// <b>Who uploaded it is <see cref="BaseAuditableEntity.CreatedBy"/></b>, filled in by
/// <c>AuditableEntityInterceptor</c> from the signed-in user, and when is <c>Created</c>. There is
/// no separate uploader column: a second copy of a fact the base class already records is a second
/// thing that can disagree with it.
/// </para>
/// <para>
/// <b><see cref="StoredKey"/> is an object key, never a URL.</b> Nothing turns it into one for a
/// browser. These files belong to a meeting whose audience is controlled, so they are fetched
/// through the API with the caller's token and streamed back — the same reasoning as the Kurdnezam
/// form attachments, which may hold a scan of somebody's national id card.
/// </para>
/// <para>
/// The row cascades from its <see cref="Room"/>, so deleting a meeting removes its rows. The
/// objects in MinIO do <b>not</b> follow automatically — a database cascade cannot reach object
/// storage — so the delete handler removes those itself.
/// </para>
/// </remarks>
public class RoomFile : BaseAuditableEntity
{
    public int RoomId { get; set; }

    public Room Room { get; set; } = null!;

    /// <summary>The name the file had when it was uploaded, used when somebody downloads it.</summary>
    public required string FileName { get; set; }

    /// <summary>Object key inside the bucket, e.g. <c>rooms/12/9f3c….pdf</c>. Never handed to a browser.</summary>
    public required string StoredKey { get; set; }

    public required string ContentType { get; set; }

    public long SizeBytes { get; set; }
}
