namespace Mabhas19.Application.Kurdnezam.Contact;

/// <summary>A message submitted from the public contact page, as served to the admin panel.</summary>
public sealed class KurdnezamContactMessageDto
{
    public int Id { get; init; }

    public string Name { get; init; } = string.Empty;

    public string Phone { get; init; } = string.Empty;

    public string Subject { get; init; } = string.Empty;

    public string Message { get; init; } = string.Empty;

    public bool IsRead { get; init; }

    public DateTimeOffset Created { get; init; }
}
