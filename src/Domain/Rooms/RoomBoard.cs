using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Rooms;

/// <summary>
/// One meeting's whiteboard. Delivered live over the media server's data channel; this is the copy
/// that survives a reload and lets somebody who joined late see what is already drawn.
/// </summary>
/// <remarks>
/// <para>
/// <see cref="Scene"/> is stored <b>opaque</b>: it is whatever the editor serialised, kept as text and
/// never modelled here. An Excalidraw scene is a large, evolving shape, and a typed DTO would silently
/// drop every field it did not declare — see GOTCHAS.
/// </para>
/// <para>
/// One row per meeting. <see cref="UpdatedBy"/> records who last saved, for the same reason a chat line
/// records its sender — but unlike chat it is never returned to a client, because for an engineer that
/// identity is their کد ملی.
/// </para>
/// </remarks>
public class RoomBoard : BaseAuditableEntity
{
    public int RoomId { get; set; }

    public Room Room { get; set; } = null!;

    public required string Scene { get; set; }

    public required string UpdatedBy { get; set; }
}
