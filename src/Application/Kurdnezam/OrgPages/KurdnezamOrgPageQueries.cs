using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.OrgPages;

/// <summary>Every org page, in menu order. Small, fixed-size set — no paging.</summary>
public record GetKurdnezamOrgPagesQuery : IRequest<IReadOnlyList<KurdnezamOrgPageDto>>;

public class GetKurdnezamOrgPagesQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamOrgPagesQuery, IReadOnlyList<KurdnezamOrgPageDto>>
{
    public async Task<IReadOnlyList<KurdnezamOrgPageDto>> Handle(GetKurdnezamOrgPagesQuery request, CancellationToken cancellationToken)
        => await context.KurdnezamOrgPages
            .AsNoTracking()
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.Id)
            .Select(p => new KurdnezamOrgPageDto
            {
                Id = p.Id,
                Slug = p.Slug,
                Title = p.Title,
                Group = p.Group,
                Intro = p.Intro,
                SortOrder = p.SortOrder
            })
            .ToListAsync(cancellationToken);
}

/// <summary>A single page. Looked up by slug, not id — that is how the site routes <c>/p/{slug}</c>.</summary>
public record GetKurdnezamOrgPageBySlugQuery(string Slug) : IRequest<KurdnezamOrgPageDto>;

public class GetKurdnezamOrgPageBySlugQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamOrgPageBySlugQuery, KurdnezamOrgPageDto>
{
    public async Task<KurdnezamOrgPageDto> Handle(GetKurdnezamOrgPageBySlugQuery request, CancellationToken cancellationToken)
    {
        var dto = await context.KurdnezamOrgPages
            .AsNoTracking()
            .Where(p => p.Slug == request.Slug)
            .Select(p => new KurdnezamOrgPageDto
            {
                Id = p.Id,
                Slug = p.Slug,
                Title = p.Title,
                Group = p.Group,
                Intro = p.Intro,
                SortOrder = p.SortOrder
            })
            .FirstOrDefaultAsync(cancellationToken);

        Guard.Against.NotFound(request.Slug, dto);

        return dto;
    }
}
