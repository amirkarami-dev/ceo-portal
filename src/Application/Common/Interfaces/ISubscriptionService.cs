using Mabhas19.Domain.Entities;

namespace Mabhas19.Application.Common.Interfaces;

public interface ISubscriptionService
{
    /// <summary>Returns the user's subscription, creating a default Free plan if none exists.</summary>
    Task<Subscription> GetOrCreateAsync(string userId, CancellationToken ct = default);

    /// <summary>Throws a validation error if the user's subscription is not active. The per-user
    /// project cap has been removed, so an active user can create unlimited projects.</summary>
    Task EnsureCanCreateProjectAsync(string userId, CancellationToken ct = default);
}
