using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.Slides;

/// <summary>
/// The whole slider, in display order. The set is small and rendered in one go, so it is not paged.
/// </summary>
public record GetKurdnezamSlidesQuery : IRequest<IReadOnlyList<KurdnezamSlideDto>>;

public class GetKurdnezamSlidesQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamSlidesQuery, IReadOnlyList<KurdnezamSlideDto>>
{
    public async Task<IReadOnlyList<KurdnezamSlideDto>> Handle(GetKurdnezamSlidesQuery request, CancellationToken cancellationToken)
        => await context.KurdnezamSlides
            .AsNoTracking()
            .OrderBy(s => s.SortOrder)
            .ThenBy(s => s.Id)
            .Select(s => new KurdnezamSlideDto
            {
                Id = s.Id,
                Title = s.Title,
                Subtitle = s.Subtitle,
                Image = s.Image,
                NewsId = s.NewsId,
                NewsTitle = s.News!.Title,
                Badge = s.Badge,
                SortOrder = s.SortOrder
            })
            .ToListAsync(cancellationToken);
}

/// <summary>A single slide. Used by the admin panel's edit form.</summary>
public record GetKurdnezamSlideByIdQuery(int Id) : IRequest<KurdnezamSlideDto>;

public class GetKurdnezamSlideByIdQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamSlideByIdQuery, KurdnezamSlideDto>
{
    public async Task<KurdnezamSlideDto> Handle(GetKurdnezamSlideByIdQuery request, CancellationToken cancellationToken)
    {
        var dto = await context.KurdnezamSlides
            .AsNoTracking()
            .Where(s => s.Id == request.Id)
            .Select(s => new KurdnezamSlideDto
            {
                Id = s.Id,
                Title = s.Title,
                Subtitle = s.Subtitle,
                Image = s.Image,
                NewsId = s.NewsId,
                NewsTitle = s.News!.Title,
                Badge = s.Badge,
                SortOrder = s.SortOrder
            })
            .FirstOrDefaultAsync(cancellationToken);

        Guard.Against.NotFound(request.Id, dto);

        return dto;
    }
}
