using Mabhas19.Application.Common.Exceptions;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Infrastructure.Subscriptions;

public class SubscriptionService : ISubscriptionService
{
    private readonly IApplicationDbContext _context;
    private readonly TimeProvider _clock;

    public SubscriptionService(IApplicationDbContext context, TimeProvider clock)
    {
        _context = context;
        _clock = clock;
    }

    public async Task<Subscription> GetOrCreateAsync(string userId, CancellationToken ct = default)
    {
        var sub = await _context.Subscriptions.FirstOrDefaultAsync(s => s.UserId == userId, ct);
        if (sub is not null) return sub;

        sub = new Subscription
        {
            UserId = userId,
            Plan = Domain.Enums.SubscriptionPlan.Free,
            MaxProjects = Subscription.DefaultMaxProjects,
            ValidFrom = _clock.GetUtcNow(),
            IsActive = true
        };

        _context.Subscriptions.Add(sub);
        await _context.SaveChangesAsync(ct);
        return sub;
    }

    public async Task EnsureCanCreateProjectAsync(string userId, CancellationToken ct = default)
    {
        var sub = await GetOrCreateAsync(userId, ct);

        if (!sub.IsActive)
        {
            Throw("حساب کاربری شما فعال نیست.");
        }

        // The per-user project cap has been removed — active users may create unlimited
        // projects. (MaxProjects is kept on the record for admin display only.)
    }

    private static void Throw(string message)
    {
        var ex = new ValidationException();
        ex.Errors["Subscription"] = new[] { message };
        throw ex;
    }
}
