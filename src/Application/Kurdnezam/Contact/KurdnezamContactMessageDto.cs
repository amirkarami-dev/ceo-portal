namespace Mabhas19.Application.Kurdnezam.Contact;

/// <summary>A message submitted from the public contact page, as served to the admin panel.</summary>
public sealed class KurdnezamContactMessageDto
{
    public int Id { get; init; }

    public string Name { get; init; } = string.Empty;

    public string Phone { get; init; } = string.Empty;

    public string Subject { get; init; } = string.Empty;

    public string Message { get; init; } = string.Empty;

    /// <summary>The contact block the sender chose, if any.</summary>
    public int? SectionId { get; init; }

    /// <summary>
    /// Title of that block, resolved for display. Null both when the sender chose nothing and when
    /// the block has since been deleted — the FK is <c>SET NULL</c>, so old messages survive it.
    /// </summary>
    public string? SectionTitle { get; init; }

    public bool IsRead { get; init; }

    public DateTimeOffset Created { get; init; }
}
