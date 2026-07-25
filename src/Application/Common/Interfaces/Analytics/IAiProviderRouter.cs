namespace Mabhas19.Application.Common.Interfaces.Analytics;

/// <summary>Routes a completion prompt to the most appropriate AI provider and returns the raw completion text.</summary>
public interface IAiProviderRouter
{
    Task<string> CompleteAsync(string prompt, CancellationToken cancellationToken = default);
}
