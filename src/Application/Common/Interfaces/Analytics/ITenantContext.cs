namespace Mabhas19.Application.Common.Interfaces.Analytics;

/// <summary>Exposes the current request's tenant identifier (null when not in a tenanted context).</summary>
public interface ITenantContext
{
    string? TenantId { get; }
}
