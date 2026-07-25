using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.QuickLinks;

/// <summary>Every quick link, in display order. The list is small, so it is not paged.</summary>
public record GetKurdnezamQuickLinksQuery : IRequest<IReadOnlyList<KurdnezamQuickLinkDto>>;

public class GetKurdnezamQuickLinksQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamQuickLinksQuery, IReadOnlyList<KurdnezamQuickLinkDto>>
{
    public async Task<IReadOnlyList<KurdnezamQuickLinkDto>> Handle(GetKurdnezamQuickLinksQuery request, CancellationToken cancellationToken)
        => await context.KurdnezamQuickLinks
            .AsNoTracking()
            .OrderBy(l => l.SortOrder)
            .ThenBy(l => l.Id)
            .Select(l => new KurdnezamQuickLinkDto
            {
                Id = l.Id,
                Title = l.Title,
                Href = l.Href,
                Icon = l.Icon,
                SortOrder = l.SortOrder
            })
            .ToListAsync(cancellationToken);
}

/// <summary>A single quick link. Used by the admin edit form.</summary>
public record GetKurdnezamQuickLinkByIdQuery(int Id) : IRequest<KurdnezamQuickLinkDto>;

public class GetKurdnezamQuickLinkByIdQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamQuickLinkByIdQuery, KurdnezamQuickLinkDto>
{
    public async Task<KurdnezamQuickLinkDto> Handle(GetKurdnezamQuickLinkByIdQuery request, CancellationToken cancellationToken)
    {
        var dto = await context.KurdnezamQuickLinks
            .AsNoTracking()
            .Where(l => l.Id == request.Id)
            .Select(l => new KurdnezamQuickLinkDto
            {
                Id = l.Id,
                Title = l.Title,
                Href = l.Href,
                Icon = l.Icon,
                SortOrder = l.SortOrder
            })
            .FirstOrDefaultAsync(cancellationToken);

        Guard.Against.NotFound(request.Id, dto);

        return dto;
    }
}
