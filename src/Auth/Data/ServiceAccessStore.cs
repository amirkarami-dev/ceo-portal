using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Auth.Data;

public class ServiceAccessStore(AuthDbContext context) : IServiceAccessStore
{
    public async Task<IReadOnlyList<string>> GetServiceKeysAsync(
        string userId, CancellationToken cancellationToken = default) =>
        await context.UserServiceAccess
            .AsNoTracking()
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.ServiceKey)
            .Select(x => x.ServiceKey)
            .ToListAsync(cancellationToken);

    public async Task ReplaceAsync(string userId, IEnumerable<string> serviceKeys, string? grantedBy,
        CancellationToken cancellationToken = default)
    {
        // Normalise to canonical keys, drop invalid ones, and de-duplicate (case-insensitive).
        var keys = serviceKeys
            .Select(ServiceKeys.Normalize)
            .Where(k => k is not null)
            .Select(k => k!)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

        await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);

        var existing = await context.UserServiceAccess
            .Where(x => x.UserId == userId)
            .ToListAsync(cancellationToken);
        context.UserServiceAccess.RemoveRange(existing);

        var now = DateTimeOffset.UtcNow;
        foreach (var key in keys)
        {
            context.UserServiceAccess.Add(new UserServiceAccess
            {
                UserId       = userId,
                ServiceKey   = key,
                GrantedAtUtc = now,
                GrantedBy    = grantedBy
            });
        }

        await context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
    }
}
