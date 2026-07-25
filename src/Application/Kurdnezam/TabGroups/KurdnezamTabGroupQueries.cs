using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Domain.Kurdnezam;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.TabGroups;

/// <summary>
/// Every tab group with its items nested. The whole panel is a handful of rows, so it is served
/// unpaged and in one round-trip.
/// </summary>
public record GetKurdnezamTabGroupsQuery : IRequest<IReadOnlyList<KurdnezamTabGroupDto>>;

public class GetKurdnezamTabGroupsQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamTabGroupsQuery, IReadOnlyList<KurdnezamTabGroupDto>>
{
    public async Task<IReadOnlyList<KurdnezamTabGroupDto>> Handle(GetKurdnezamTabGroupsQuery request, CancellationToken cancellationToken)
    {
        var groups = await context.KurdnezamTabGroups
            .AsNoTracking()
            .Include(g => g.Items)
            .OrderBy(g => g.SortOrder)
            .ThenBy(g => g.Id)
            .ToListAsync(cancellationToken);

        return groups.Select(KurdnezamTabGroupMapping.ToDto).ToList();
    }
}

/// <summary>A single tab group with its items.</summary>
public record GetKurdnezamTabGroupByIdQuery(int Id) : IRequest<KurdnezamTabGroupDto>;

public class GetKurdnezamTabGroupByIdQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamTabGroupByIdQuery, KurdnezamTabGroupDto>
{
    public async Task<KurdnezamTabGroupDto> Handle(GetKurdnezamTabGroupByIdQuery request, CancellationToken cancellationToken)
    {
        var group = await context.KurdnezamTabGroups
            .AsNoTracking()
            .Include(g => g.Items)
            .FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, group);

        return KurdnezamTabGroupMapping.ToDto(group);
    }
}

/// <remarks>Items are ordered here rather than in SQL — <c>Include</c> carries no ORDER BY.</remarks>
internal static class KurdnezamTabGroupMapping
{
    public static KurdnezamTabGroupDto ToDto(KurdnezamTabGroup group) => new()
    {
        Id = group.Id,
        Slug = group.Slug,
        Title = group.Title,
        SortOrder = group.SortOrder,
        Items = group.Items
            .OrderBy(i => i.SortOrder)
            .ThenBy(i => i.Id)
            .Select(i => new KurdnezamTabItemDto
            {
                Id = i.Id,
                Title = i.Title,
                Href = i.Href,
                Note = i.Note,
                SortOrder = i.SortOrder
            })
            .ToList()
    };
}
