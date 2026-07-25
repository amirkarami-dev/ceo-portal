using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.Categories;

/// <summary>All categories, in display order. Drives the news filter pills and the admin list.</summary>
public record GetKurdnezamCategoriesQuery : IRequest<IReadOnlyList<KurdnezamCategoryDto>>;

public class GetKurdnezamCategoriesQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamCategoriesQuery, IReadOnlyList<KurdnezamCategoryDto>>
{
    public async Task<IReadOnlyList<KurdnezamCategoryDto>> Handle(GetKurdnezamCategoriesQuery request, CancellationToken cancellationToken)
        => await context.KurdnezamCategories
            .AsNoTracking()
            .OrderBy(c => c.SortOrder)
            .ThenBy(c => c.Id)
            .Select(c => new KurdnezamCategoryDto
            {
                Id = c.Id,
                Title = c.Title,
                SortOrder = c.SortOrder,
                NewsCount = c.News.Count()
            })
            .ToListAsync(cancellationToken);
}

/// <summary>A single category. Used by <c>/categories/{id}</c>.</summary>
public record GetKurdnezamCategoryByIdQuery(int Id) : IRequest<KurdnezamCategoryDto>;

public class GetKurdnezamCategoryByIdQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamCategoryByIdQuery, KurdnezamCategoryDto>
{
    public async Task<KurdnezamCategoryDto> Handle(GetKurdnezamCategoryByIdQuery request, CancellationToken cancellationToken)
    {
        var dto = await context.KurdnezamCategories
            .AsNoTracking()
            .Where(c => c.Id == request.Id)
            .Select(c => new KurdnezamCategoryDto
            {
                Id = c.Id,
                Title = c.Title,
                SortOrder = c.SortOrder,
                NewsCount = c.News.Count()
            })
            .FirstOrDefaultAsync(cancellationToken);

        Guard.Against.NotFound(request.Id, dto);

        return dto;
    }
}
