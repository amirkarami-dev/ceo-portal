using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Analytics;

namespace Mabhas19.Infrastructure.Analytics;

/// <summary>
/// Reads the current tenant from the authenticated user's claims via <see cref="IUser"/>.
/// Falls back to null when no tenant claim is present (single-tenant mode).
/// TODO(v2): define a dedicated "tenant_id" JWT claim on the IdP and map it here.
/// </summary>
internal sealed class TenantContext : ITenantContext
{
    private readonly IUser _user;

    public TenantContext(IUser user)
    {
        _user = user;
    }

    /// <inheritdoc/>
    /// <remarks>Returns null until a tenant claim is issued by the IdP (v2).</remarks>
    public string? TenantId => null; // TODO(v2): _user.Roles?.FirstOrDefault(r => r.StartsWith("tenant:"))?.["tenant:".Length..];
}
