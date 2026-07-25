using Mabhas19.Application.Common.Interfaces;

namespace Mabhas19.Application.Kurdnezam.FooterLinks;

/// <summary>The full footer link list, in render order. Small and unpaged by design.</summary>
public record GetKurdnezamFooterLinksQuery : IRequest<IReadOnlyList<KurdnezamFooterLinkDto>>;

public class GetKurdnezamFooterLinksQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamFooterLinksQuery, IReadOnlyList<KurdnezamFooterLinkDto>>
{
    public async Task<IReadOnlyList<KurdnezamFooterLinkDto>> Handle(GetKurdnezamFooterLinksQuery request, CancellationToken cancellationToken)
        => await context.KurdnezamFooterLinks
            .AsNoTracking()
            .OrderBy(l => l.SortOrder)
            .ThenBy(l => l.Id)
            .Select(l => new KurdnezamFooterLinkDto
            {
                Id = l.Id,
                Title = l.Title,
                Href = l.Href,
                SortOrder = l.SortOrder
            })
            .ToListAsync(cancellationToken);
}
