using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;

namespace Mabhas19.Application.Subscriptions.Queries.GetMySubscription;

[Authorize]
public record GetMySubscriptionQuery : IRequest<SubscriptionDto>;

public record SubscriptionDto
{
    public string Plan { get; init; } = string.Empty;
    public int MaxProjects { get; init; }
    public int UsedProjects { get; init; }
    public bool IsActive { get; init; }
    public DateTimeOffset? ValidTo { get; init; }
}

public class GetMySubscriptionQueryHandler : IRequestHandler<GetMySubscriptionQuery, SubscriptionDto>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user;
    private readonly ISubscriptionService _subscriptions;

    public GetMySubscriptionQueryHandler(IApplicationDbContext context, IUser user, ISubscriptionService subscriptions)
    {
        _context = context;
        _user = user;
        _subscriptions = subscriptions;
    }

    public async Task<SubscriptionDto> Handle(GetMySubscriptionQuery request, CancellationToken cancellationToken)
    {
        var userId = _user.Id!;
        var sub = await _subscriptions.GetOrCreateAsync(userId, cancellationToken);
        var used = await _context.Projects.CountAsync(p => p.OwnerId == userId, cancellationToken);

        return new SubscriptionDto
        {
            Plan = sub.Plan.ToString(),
            MaxProjects = sub.MaxProjects,
            UsedProjects = used,
            IsActive = sub.IsActive,
            ValidTo = sub.ValidTo
        };
    }
}
