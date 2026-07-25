using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.People;

/// <summary>
/// Public roster of an organisation body. Unfiltered it returns every person; the site calls it
/// once per <c>/p/{slug}</c> page with that page's group.
/// </summary>
public record GetKurdnezamPeopleQuery(string? Group = null) : IRequest<IReadOnlyList<KurdnezamPersonDto>>;

public class GetKurdnezamPeopleQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamPeopleQuery, IReadOnlyList<KurdnezamPersonDto>>
{
    public async Task<IReadOnlyList<KurdnezamPersonDto>> Handle(GetKurdnezamPeopleQuery request, CancellationToken cancellationToken)
    {
        var query = context.KurdnezamPeople.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(request.Group))
        {
            var group = request.Group.Trim();
            query = query.Where(p => p.Group == group);
        }

        return await query
            .OrderBy(p => p.SortOrder)
            .ThenBy(p => p.Id)
            .Select(p => new KurdnezamPersonDto
            {
                Id = p.Id,
                Name = p.Name,
                Role = p.Role,
                Image = p.Image,
                Group = p.Group,
                SortOrder = p.SortOrder
            })
            .ToListAsync(cancellationToken);
    }
}

/// <summary>A single person. Used by the admin edit form.</summary>
public record GetKurdnezamPersonByIdQuery(int Id) : IRequest<KurdnezamPersonDto>;

public class GetKurdnezamPersonByIdQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamPersonByIdQuery, KurdnezamPersonDto>
{
    public async Task<KurdnezamPersonDto> Handle(GetKurdnezamPersonByIdQuery request, CancellationToken cancellationToken)
    {
        var dto = await context.KurdnezamPeople
            .AsNoTracking()
            .Where(p => p.Id == request.Id)
            .Select(p => new KurdnezamPersonDto
            {
                Id = p.Id,
                Name = p.Name,
                Role = p.Role,
                Image = p.Image,
                Group = p.Group,
                SortOrder = p.SortOrder
            })
            .FirstOrDefaultAsync(cancellationToken);

        Guard.Against.NotFound(request.Id, dto);

        return dto;
    }
}
