namespace Mabhas19.Application.Kurdnezam.Units;

/// <summary>An organisational unit (واحد) as served to the public site and the admin panel.</summary>
public sealed class KurdnezamUnitDto
{
    public int Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public string Description { get; init; } = string.Empty;

    /// <summary>Flat on the wire; the site composes <c>head: { name, role }</c> from these two.</summary>
    public string? HeadName { get; init; }

    public string? HeadRole { get; init; }

    public int SortOrder { get; init; }
}
