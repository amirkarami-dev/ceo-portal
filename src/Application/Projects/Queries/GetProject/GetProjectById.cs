using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;

namespace Mabhas19.Application.Projects.Queries.GetProject;

[Authorize]
public record GetProjectByIdQuery(int Id) : IRequest<ProjectDto>;

public class GetProjectByIdQueryHandler : IRequestHandler<GetProjectByIdQuery, ProjectDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly IUser _user;

    public GetProjectByIdQueryHandler(IApplicationDbContext context, IMapper mapper, IUser user)
    {
        _context = context;
        _mapper = mapper;
        _user = user;
    }

    public async Task<ProjectDto> Handle(GetProjectByIdQuery request, CancellationToken cancellationToken)
    {
        var dto = await _context.Projects
            .AsNoTracking()
            .Where(p => p.Id == request.Id && p.OwnerId == _user.Id)
            .ProjectTo<ProjectDto>(_mapper.ConfigurationProvider)
            .FirstOrDefaultAsync(cancellationToken);

        Guard.Against.NotFound(request.Id, dto);

        return dto;
    }
}
