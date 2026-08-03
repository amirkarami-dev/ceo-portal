using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Domain.Kurdnezam;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.ContactSections;

/// <summary>
/// Every contact section with its rows nested. A handful of rows in total, so it is served unpaged
/// and in one round-trip, like the tab groups it is modelled on.
/// </summary>
/// <param name="IncludeInactive">
/// The admin panel needs to see a retired section in order to bring it back; the public site must
/// not. Defaults to the public view, so forgetting the flag under-shares rather than over-shares.
/// </param>
public record GetKurdnezamContactSectionsQuery(bool IncludeInactive = false)
    : IRequest<IReadOnlyList<KurdnezamContactSectionDto>>;

public class GetKurdnezamContactSectionsQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamContactSectionsQuery, IReadOnlyList<KurdnezamContactSectionDto>>
{
    public async Task<IReadOnlyList<KurdnezamContactSectionDto>> Handle(
        GetKurdnezamContactSectionsQuery request, CancellationToken cancellationToken)
    {
        var query = context.KurdnezamContactSections
            .AsNoTracking()
            .Include(s => s.Channels)
            .AsQueryable();

        if (!request.IncludeInactive)
        {
            query = query.Where(s => s.IsActive);
        }

        var sections = await query
            .OrderBy(s => s.SortOrder)
            .ThenBy(s => s.Id)
            .ToListAsync(cancellationToken);

        return sections.Select(KurdnezamContactSectionMapping.ToDto).ToList();
    }
}

/// <summary>A single section with its rows. Returns a retired section too — the admin edits it.</summary>
public record GetKurdnezamContactSectionByIdQuery(int Id) : IRequest<KurdnezamContactSectionDto>;

public class GetKurdnezamContactSectionByIdQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamContactSectionByIdQuery, KurdnezamContactSectionDto>
{
    public async Task<KurdnezamContactSectionDto> Handle(
        GetKurdnezamContactSectionByIdQuery request, CancellationToken cancellationToken)
    {
        var section = await context.KurdnezamContactSections
            .AsNoTracking()
            .Include(s => s.Channels)
            .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, section);

        return KurdnezamContactSectionMapping.ToDto(section);
    }
}

/// <remarks>Channels are ordered here rather than in SQL — <c>Include</c> carries no ORDER BY.</remarks>
internal static class KurdnezamContactSectionMapping
{
    public static KurdnezamContactSectionDto ToDto(KurdnezamContactSection section) => new()
    {
        Id = section.Id,
        Title = section.Title,
        Description = section.Description,
        Icon = section.Icon,
        SortOrder = section.SortOrder,
        IsActive = section.IsActive,
        Channels = section.Channels
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Id)
            .Select(c => new KurdnezamContactChannelDto
            {
                Id = c.Id,
                Kind = c.Kind,
                Label = c.Label,
                Value = c.Value,
                SortOrder = c.SortOrder
            })
            .ToList()
    };
}
