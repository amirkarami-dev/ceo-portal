using Mabhas19.Domain.Entities;

namespace Mabhas19.Application.Assessments;

public class AssessmentDto
{
    public int ProjectId { get; init; }
    public string InputJson { get; init; } = "{}";
    public string ResultJson { get; init; } = "{}";
    public int TotalScore { get; init; }
    public int MaxScore { get; init; }
    public string Status { get; init; } = string.Empty;

    private class Mapping : Profile
    {
        public Mapping()
        {
            CreateMap<Assessment, AssessmentDto>()
                .ForMember(d => d.Status, o => o.MapFrom(s => s.Status.ToString()));
        }
    }
}
