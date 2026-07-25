using Mabhas19.Application.Common.Exceptions;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;

namespace Mabhas19.Application.Projects.Commands.DeleteProject;

[Authorize]
public record DeleteProjectCommand(int Id) : IRequest;

public class DeleteProjectCommandHandler : IRequestHandler<DeleteProjectCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user;

    public DeleteProjectCommandHandler(IApplicationDbContext context, IUser user)
    {
        _context = context;
        _user = user;
    }

    public async Task Handle(DeleteProjectCommand request, CancellationToken cancellationToken)
    {
        var entity = await _context.Projects.FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        if (entity.OwnerId != _user.Id) throw new ForbiddenAccessException();

        _context.Projects.Remove(entity);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
