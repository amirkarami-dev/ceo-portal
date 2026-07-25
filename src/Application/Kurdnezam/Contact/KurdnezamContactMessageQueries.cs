using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Application.Kurdnezam.Common;
using Mabhas19.Domain.Constants;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.Contact;

/// <summary>
/// The admin inbox: every message the public contact form has submitted, newest first, optionally
/// narrowed to the unread ones. Paged in SQL.
/// </summary>
[Authorize(Roles = Roles.Administrator)]
public record GetKurdnezamContactMessagesQuery(
    bool? IsRead = null,
    int Page = 1,
    int PageSize = 20) : IRequest<KurdnezamPagedResult<KurdnezamContactMessageDto>>;

public class GetKurdnezamContactMessagesQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamContactMessagesQuery, KurdnezamPagedResult<KurdnezamContactMessageDto>>
{
    public async Task<KurdnezamPagedResult<KurdnezamContactMessageDto>> Handle(GetKurdnezamContactMessagesQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var query = context.KurdnezamContactMessages.AsNoTracking().AsQueryable();

        if (request.IsRead is { } isRead)
            query = query.Where(m => m.IsRead == isRead);

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(m => m.Created)
            .ThenByDescending(m => m.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => new KurdnezamContactMessageDto
            {
                Id = m.Id,
                Name = m.Name,
                Phone = m.Phone,
                Subject = m.Subject,
                Message = m.Message,
                IsRead = m.IsRead,
                Created = m.Created
            })
            .ToListAsync(cancellationToken);

        return new KurdnezamPagedResult<KurdnezamContactMessageDto>
        {
            Items = items,
            Total = total,
            Page = page,
            PageSize = pageSize
        };
    }
}
