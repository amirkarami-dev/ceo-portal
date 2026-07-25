using Mabhas19.Domain.Enums;
using Mabhas19.Domain.Services;

namespace Mabhas19.Domain.Entities;

/// <summary>A building project owned by a user, evaluated against Section 19.</summary>
public class Project : BaseAuditableEntity
{
    public required string Title { get; set; }

    public string? Client { get; set; }

    public string? Address { get; set; }

    /// <summary>City name (Persian), e.g. "تهران". Drives the climate zone.</summary>
    public string City { get; set; } = string.Empty;

    /// <summary>Climate zone code: 1, 2, 3A, 3B, 4, 5.</summary>
    public string ClimateCode { get; set; } = "3B";

    public double TotalArea { get; set; }

    public int FloorCount { get; set; }

    public int UnitCount { get; set; }

    /// <summary>Building usage / occupancy type (Persian label).</summary>
    public string? Usage { get; set; }

    // Identifiers commonly carried from imported records.
    public string? Deed { get; set; }
    public string? Parcel { get; set; }
    public string? SystemId { get; set; }

    /// <summary>Owning Identity user id.</summary>
    public required string OwnerId { get; set; }

    public ProjectSource Source { get; set; } = ProjectSource.Manual;

    /// <summary>External reference id when imported (نظام مهندسی ساختمان record id, or FarsNezam ProjectNo).</summary>
    public string? ExternalId { get; set; }

    /// <summary>Comma-separated assessment section keys the owner may EDIT, e.g. "env,elec".
    /// Null/empty means all sections are editable (manually-created projects). Derived from
    /// the external typ list at FarsNezam import time.</summary>
    public string? AllowedSections { get; set; }

    public Assessment? Assessment { get; set; }

    /// <summary>Computed Section 19 building group from current dimensions.</summary>
    public BuildingGroup BuildingGroup => BuildingGroupCalculator.Calculate(TotalArea, FloorCount, UnitCount);
}
