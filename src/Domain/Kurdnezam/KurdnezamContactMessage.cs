using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// A message sent from the public contact page (<c>/p/tamas</c>), which previously discarded it.
/// </summary>
public class KurdnezamContactMessage : BaseAuditableEntity
{
    public string Name { get; set; } = string.Empty;

    public string Phone { get; set; } = string.Empty;

    public string Subject { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;

    /// <summary>
    /// Which contact block the sender picked, if any. Nullable and <c>ON DELETE SET NULL</c>:
    /// retiring a section must never delete the messages people sent to it.
    /// </summary>
    public int? SectionId { get; set; }

    public KurdnezamContactSection? Section { get; set; }

    public bool IsRead { get; set; }
}
