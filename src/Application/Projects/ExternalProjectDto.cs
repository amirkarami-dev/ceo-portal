namespace Mabhas19.Application.Projects;

/// <summary>Project data fetched from an external service prior to import.</summary>
public record ExternalProjectDto
{
    public string? Title { get; init; }
    public string? Client { get; init; }
    public string? Address { get; init; }
    public string? City { get; init; }
    public string? ClimateCode { get; init; }
    public double TotalArea { get; init; }
    public int FloorCount { get; init; }
    public int UnitCount { get; init; }
    public string? Usage { get; init; }
    public string? Deed { get; init; }
    public string? Parcel { get; init; }
    public string? SystemId { get; init; }

    /// <summary>Comma-separated assessment section keys editable for this project
    /// (FarsNezam typ list → env/elec/mech). Null when the source has no such concept.</summary>
    public string? AllowedSections { get; init; }
}
