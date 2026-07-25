using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Entities;

namespace Mabhas19.Application.Projects.Commands.CreateProject;

[Authorize]
public record CreateProjectCommand : IRequest<int>
{
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

public class CreateProjectCommandHandler : IRequestHandler<CreateProjectCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user;
    private readonly ISubscriptionService _subscriptions;

    public CreateProjectCommandHandler(IApplicationDbContext context, IUser user, ISubscriptionService subscriptions)
    {
        _context = context;
        _user = user;
        _subscriptions = subscriptions;
    }

    public async Task<int> Handle(CreateProjectCommand request, CancellationToken cancellationToken)
    {
        var userId = _user.Id!;

        await _subscriptions.EnsureCanCreateProjectAsync(userId, cancellationToken);

        var climateCode = !string.IsNullOrWhiteSpace(request.ClimateCode)
            ? request.ClimateCode!
            : Domain.Services.ClimateData.GetCityClimate(request.City);

        var entity = new Project
        {
            Title = request.Title,
            Client = request.Client,
            Address = request.Address,
            City = request.City,
            ClimateCode = climateCode,
            TotalArea = request.TotalArea,
            FloorCount = request.FloorCount,
            UnitCount = request.UnitCount,
            Usage = request.Usage,
            Deed = request.Deed,
            Parcel = request.Parcel,
            SystemId = request.SystemId,
            OwnerId = userId
        };

        _context.Projects.Add(entity);
        await _context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}
