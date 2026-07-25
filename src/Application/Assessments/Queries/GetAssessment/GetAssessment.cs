using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;

namespace Mabhas19.Application.Assessments.Queries.GetAssessment;

[Authorize]
public record GetAssessmentQuery(int ProjectId) : IRequest<AssessmentDto?>;

public class GetAssessmentQueryHandler : IRequestHandler<GetAssessmentQuery, AssessmentDto?>
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    private readonly IUser _user;

    public GetAssessmentQueryHandler(IApplicationDbContext context, IMapper mapper, IUser user)
    {
        _context = context;
        _mapper = mapper;
        _user = user;
    }

    public async Task<AssessmentDto?> Handle(GetAssessmentQuery request, CancellationToken cancellationToken)
    {
        return await _context.Assessments
            .AsNoTracking()
            .Where(a => a.ProjectId == request.ProjectId && a.Project.OwnerId == _user.Id)
            .ProjectTo<AssessmentDto>(_mapper.ConfigurationProvider)
            .FirstOrDefaultAsync(cancellationToken);
    }
}
