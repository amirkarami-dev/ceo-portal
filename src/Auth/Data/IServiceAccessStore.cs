namespace Mabhas19.Auth.Data;

/// <summary>
/// Reads and replaces a user's product-service grants (see <see cref="UserServiceAccess"/>).
/// </summary>
public interface IServiceAccessStore
{
    /// <summary>The canonical service keys currently granted to the user (empty = grandfathered).</summary>
    Task<IReadOnlyList<string>> GetServiceKeysAsync(string userId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Transactionally replaces the user's grants with exactly <paramref name="serviceKeys"/>.
    /// Invalid keys are ignored and duplicates collapsed. Passing an empty set clears all grants
    /// (grandfathering the user back to all services).
    /// </summary>
    Task ReplaceAsync(string userId, IEnumerable<string> serviceKeys, string? grantedBy,
        CancellationToken cancellationToken = default);
}
