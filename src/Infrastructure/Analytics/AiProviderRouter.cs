using Mabhas19.Application.Common.Interfaces.Analytics;

namespace Mabhas19.Infrastructure.Analytics;

/// <summary>
/// Stub AI provider router.
/// TODO(v2): select the highest-priority enabled <see cref="Domain.Analytics.AiProvider"/> and
/// forward the prompt to the appropriate SDK (OpenAI, Azure OpenAI, etc.).
/// </summary>
internal sealed class AiProviderRouter : IAiProviderRouter
{
    public Task<string> CompleteAsync(string prompt, CancellationToken cancellationToken = default)
        => throw new NotImplementedException("v2");
}
