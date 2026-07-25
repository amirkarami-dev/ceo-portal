namespace Mabhas19.Application.Common.Interfaces.Analytics;

/// <summary>
/// Appends an immutable audit event to the analytics audit log.
/// Implementations should be fire-and-forget safe (should not throw).
/// </summary>
public interface IAuditLogger
{
    /// <summary>
    /// Log an audit event.
    /// </summary>
    /// <param name="type">Short dot-separated event type, e.g. "ai.generate", "report.saved".</param>
    /// <param name="actorName">Display name or ID of the acting user; null if anonymous.</param>
    /// <param name="detail">Optional free-form detail object to serialise into DetailJson.</param>
    /// <param name="cancellationToken">Cancellation token.</param>
    Task LogAsync(string type, string? actorName, object? detail, CancellationToken cancellationToken = default);
}
