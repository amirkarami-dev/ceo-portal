using Mabhas19.Application.Common.Exceptions;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;

namespace Mabhas19.Application.Projects.Commands.UpdateProject;

[Authorize]
public record UpdateProjectCommand : IRequest
{
    public int Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string? Client { get; init; }
    public string? Address { get; init; }
    public string City { get; init; } = string.Empty;
    public string? ClimateCode { get; init; }
    public double TotalArea { get; init; }
    public int FloorCount { get; init; }
    public int UnitCount { get; init; }
    public string? Usage { get; init; }
    public string? Deed { get; init; }
    public string? Parcel { get; init; }
    public string? SystemId { get; init; }
}

public class UpdateProjectCommandHandler : IRequestHandler<UpdateProjectCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user;

    public UpdateProjectCommandHandler(IApplicationDbContext context, IUser user)
    {
        _context = context;
        _user = user;
    }

    public async Task Handle(UpdateProjectCommand request, CancellationToken cancellationToken)
    {
        var entity = await _context.Projects.FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        if (entity.OwnerId != _user.Id) throw new ForbiddenAccessException();

        entity.Title = request.Title;
        entity.Client = request.Client;
        entity.Address = request.Address;
        entity.City = request.City;
        entity.ClimateCode = !string.IsNullOrWhiteSpace(request.ClimateCode)
            ? request.ClimateCode!
            : Domain.Services.ClimateData.GetCityClimate(request.City);
        entity.TotalArea = request.TotalArea;
        entity.FloorCount = request.FloorCount;
        entity.UnitCount = request.UnitCount;
        entity.Usage = request.Usage;
        entity.Deed = request.Deed;
        entity.Parcel = request.Parcel;
        entity.SystemId = request.SystemId;

        await _context.SaveChangesAsync(cancellationToken);
    }
}
