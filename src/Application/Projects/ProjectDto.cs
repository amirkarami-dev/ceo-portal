using Mabhas19.Domain.Entities;
using Mabhas19.Domain.Services;

namespace Mabhas19.Application.Projects;

public class ProjectDto
{
    public int Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Client { get; init; }
    public string? Address { get; init; }
    public string City { get; init; } = string.Empty;
    public string ClimateCode { get; init; } = string.Empty;
    public double TotalArea { get; init; }
    public int FloorCount { get; init; }
    public int UnitCount { get; init; }
    public string? Usage { get; init; }
    public string? Deed { get; init; }
    public string? Parcel { get; init; }
    public string? SystemId { get; init; }
    public string Source { get; init; } = string.Empty;
    public string? ExternalId { get; init; }

    /// <summary>External project number (e.g. FarsNezam ProjectNo) — alias of ExternalId for UI display.</summary>
    public string? ProjectNo { get; init; }

    /// <summary>Comma-separated section keys the owner may edit (e.g. "env,elec").
    /// Null/empty = all sections editable. Clients split on ','.</summary>
    public string? AllowedSections { get; init; }
    public string BuildingGroupCode { get; init; } = string.Empty;
    public string BuildingGroupLabel { get; init; } = string.Empty;
    public bool HasAssessment { get; init; }
    public int? TotalScore { get; init; }
    public int? MaxScore { get; init; }
    public DateTimeOffset Created { get; init; }

    private class Mapping : Profile
    {
        public Mapping()
        {
            CreateMap<Project, ProjectDto>()
                .ForMember(d => d.Source, o => o.MapFrom(s => s.Source.ToString()))
                .ForMember(d => d.ProjectNo, o => o.MapFrom(s => s.ExternalId))
                .ForMember(d => d.BuildingGroupCode, o => o.MapFrom(s => s.BuildingGroup.ToString()))
                .ForMember(d => d.BuildingGroupLabel, o => o.MapFrom(s => BuildingGroupCalculator.PersianLabel(s.BuildingGroup)))
                .ForMember(d => d.HasAssessment, o => o.MapFrom(s => s.Assessment != null))
                .ForMember(d => d.TotalScore, o => o.MapFrom(s => s.Assessment != null ? (int?)s.Assessment.TotalScore : null))
                .ForMember(d => d.MaxScore, o => o.MapFrom(s => s.Assessment != null ? (int?)s.Assessment.MaxScore : null));
        }
    }
}
