namespace Mabhas19.Application.Common.Interfaces;

/// <summary>
/// Sends one SMS. Returns whether the provider ACCEPTED it — not whether it arrived.
/// </summary>
/// <remarks>
/// Deliberately a bool rather than void: a channel that fails silently is how somebody is told
/// "link sent" about a message that was never sent. Callers must surface false.
/// </remarks>
public interface ISmsSender
{
    Task<bool> SendAsync(string phone, string message, CancellationToken cancellationToken);
}
