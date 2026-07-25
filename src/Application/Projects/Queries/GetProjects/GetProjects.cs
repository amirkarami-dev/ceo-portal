using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;

namespace Mabhas19.Application.Projects.Queries.GetProjects;

[Authorize]
public record GetProjectsQuery : IRequest<IReadOnlyList<ProjectDto>>;

public class GetProjectsQueryHandler : IRequestHandler<GetProjectsQuery, IReadOnlyList<ProjectDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly IUser _user;

    public GetProjectsQueryHandler(IApplicationDbContext context, IMapper mapper, IUser user)
    {
        _context = context;
        _mapper = mapper;
        _user = user;
    }

    public async Task<IReadOnlyList<ProjectDto>> Handle(GetProjectsQuery request, CancellationToken cancellationToken)
    {
        return await _context.Projects
            .AsNoTracking()
            .Where(p => p.OwnerId == _user.Id)
            .OrderByDescending(p => p.Created)
            .ProjectTo<ProjectDto>(_mapper.ConfigurationProvider)
            .ToListAsync(cancellationToken);
    }
}
