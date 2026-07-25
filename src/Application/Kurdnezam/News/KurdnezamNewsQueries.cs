using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Kurdnezam.Common;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.News;

/// <summary>
/// Public, filterable news feed. Search runs against title, summary, and body; results are
/// ordered newest-first and paged in SQL.
/// </summary>
public record GetKurdnezamNewsQuery(
    int? CategoryId = null,
    string? Q = null,
    bool? Featured = null,
    int? UnitId = null,
    int Page = 1,
    int PageSize = 12) : IRequest<KurdnezamPagedResult<KurdnezamNewsDto>>;

public class GetKurdnezamNewsQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamNewsQuery, KurdnezamPagedResult<KurdnezamNewsDto>>
{
    public async Task<KurdnezamPagedResult<KurdnezamNewsDto>> Handle(GetKurdnezamNewsQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var query = context.KurdnezamNews.AsNoTracking().AsQueryable();

        if (request.CategoryId is { } categoryId)
            query = query.Where(n => n.CategoryId == categoryId);

        if (request.UnitId is { } unitId)
            query = query.Where(n => n.UnitId == unitId);

        if (request.Featured is { } featured)
            query = query.Where(n => n.Featured == featured);

        if (!string.IsNullOrWhiteSpace(request.Q))
        {
            var q = request.Q.Trim();
            query = query.Where(n => n.Title.Contains(q) || n.Summary.Contains(q) || n.Body.Contains(q));
        }

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(n => n.PublishedAt)
            .ThenByDescending(n => n.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(n => new KurdnezamNewsDto
            {
                Id = n.Id,
                Title = n.Title,
                Summary = n.Summary,
                Body = n.Body,
                Date = n.DateJalali,
                PublishedAt = n.PublishedAt,
                Author = n.Author,
                CategoryId = n.CategoryId,
                CategoryTitle = n.Category!.Title,
                UnitId = n.UnitId,
                Image = n.Image,
                Featured = n.Featured,
                Attachments = n.Attachments
                    .OrderBy(a => a.SortOrder)
                    .Select(a => new KurdnezamNewsAttachmentDto
                    {
                        Id = a.Id,
                        Url = a.Url,
                        FileName = a.FileName,
                        ContentType = a.ContentType,
                        SizeBytes = a.SizeBytes,
                        SortOrder = a.SortOrder
                    })
                    .ToList()
            })
            .ToListAsync(cancellationToken);

        return new KurdnezamPagedResult<KurdnezamNewsDto>
        {
            Items = items,
            Total = total,
            Page = page,
            PageSize = pageSize
        };
    }
}

/// <summary>A single article. Used by <c>/news/{id}</c>.</summary>
public record GetKurdnezamNewsByIdQuery(int Id) : IRequest<KurdnezamNewsDto>;

public class GetKurdnezamNewsByIdQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamNewsByIdQuery, KurdnezamNewsDto>
{
    public async Task<KurdnezamNewsDto> Handle(GetKurdnezamNewsByIdQuery request, CancellationToken cancellationToken)
    {
        var dto = await context.KurdnezamNews
            .AsNoTracking()
            .Where(n => n.Id == request.Id)
            .Select(n => new KurdnezamNewsDto
            {
                Id = n.Id,
                Title = n.Title,
                Summary = n.Summary,
                Body = n.Body,
                Date = n.DateJalali,
                PublishedAt = n.PublishedAt,
                Author = n.Author,
                CategoryId = n.CategoryId,
                CategoryTitle = n.Category!.Title,
                UnitId = n.UnitId,
                Image = n.Image,
                Featured = n.Featured,
                Attachments = n.Attachments
                    .OrderBy(a => a.SortOrder)
                    .Select(a => new KurdnezamNewsAttachmentDto
                    {
                        Id = a.Id,
                        Url = a.Url,
                        FileName = a.FileName,
                        ContentType = a.ContentType,
                        SizeBytes = a.SizeBytes,
                        SortOrder = a.SortOrder
                    })
                    .ToList()
            })
            .FirstOrDefaultAsync(cancellationToken);

        Guard.Against.NotFound(request.Id, dto);

        return dto;
    }
}
