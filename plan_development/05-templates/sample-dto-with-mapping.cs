// Sample response DTO with a nested AutoMapper profile — copy to
//   src/Application/<Feature>/<Entity>Dto.cs   and replace placeholders.
//
// Replace:
//   <RootName>  — .NET namespace root (e.g. MyApp)
//   <Feature>   — feature folder (e.g. Projects)
//   <Entity>    — the source domain entity (e.g. Project)
//
// Convention: the AutoMapper profile is a PRIVATE NESTED `Mapping : Profile` class inside the
// DTO, so the mapping lives next to the shape it produces. AddMaps(Assembly...) discovers it.
// Use .ForMember(...) for computed/renamed/enum-to-string members. In query handlers, project
// straight to the DTO with `.AsNoTracking().ProjectTo<<Entity>Dto>(_mapper.ConfigurationProvider)`.
using <RootName>.Domain.Entities;

namespace <RootName>.Application.<Feature>;

public class <Entity>Dto
{
    public int Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Description { get; init; }
    public double SomeNumber { get; init; }
    public int SomeCount { get; init; }

    // Example computed/renamed members populated via .ForMember below.
    public string SourceLabel { get; init; } = string.Empty;   // enum -> string
    public bool HasChild { get; init; }                        // navigation -> bool

    public DateTimeOffset Created { get; init; }

    private class Mapping : Profile
    {
        public Mapping()
        {
            CreateMap<<Entity>, <Entity>Dto>()
                // Map an enum to its string name:
                .ForMember(d => d.SourceLabel, o => o.MapFrom(s => s.Source.ToString()))
                // Project a navigation property to a flag:
                .ForMember(d => d.HasChild, o => o.MapFrom(s => s.<Owner> != null));
        }
    }
}
