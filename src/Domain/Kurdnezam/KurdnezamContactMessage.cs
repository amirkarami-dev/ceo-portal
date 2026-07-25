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

    public bool IsRead { get; set; }
}
