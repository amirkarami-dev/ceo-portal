using Mabhas19.Application.Common.Interfaces;

namespace Mabhas19.Application.Kurdnezam.Units;

/// <summary>All units in display order. The list is small and fully rendered by the site, so it is not paged.</summary>
public record GetKurdnezamUnitsQuery : IRequest<IReadOnlyList<KurdnezamUnitDto>>;

public class GetKurdnezamUnitsQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamUnitsQuery, IReadOnlyList<KurdnezamUnitDto>>
{
    public async Task<IReadOnlyList<KurdnezamUnitDto>> Handle(GetKurdnezamUnitsQuery request, CancellationToken cancellationToken)
        => await context.KurdnezamUnits
            .AsNoTracking()
            .OrderBy(u => u.SortOrder)
            .ThenBy(u => u.Id)
            .Select(u => new KurdnezamUnitDto
            {
                Id = u.Id,
                Title = u.Title,
                Description = u.Description,
                HeadName = u.HeadName,
                HeadRole = u.HeadRole,
                SortOrder = u.SortOrder
            })
            .ToListAsync(cancellationToken);
}

/// <summary>A single unit. Used by <c>/tab-item/{id}</c>.</summary>
public record GetKurdnezamUnitByIdQuery(int Id) : IRequest<KurdnezamUnitDto>;

public class GetKurdnezamUnitByIdQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamUnitByIdQuery, KurdnezamUnitDto>
{
    public async Task<KurdnezamUnitDto> Handle(GetKurdnezamUnitByIdQuery request, CancellationToken cancellationToken)
    {
        var dto = await context.KurdnezamUnits
            .AsNoTracking()
            .Where(u => u.Id == request.Id)
            .Select(u => new KurdnezamUnitDto
            {
                Id = u.Id,
                Title = u.Title,
                Description = u.Description,
                HeadName = u.HeadName,
                HeadRole = u.HeadRole,
                SortOrder = u.SortOrder
            })
            .FirstOrDefaultAsync(cancellationToken);

        Guard.Against.NotFound(request.Id, dto);

        return dto;
    }
}
