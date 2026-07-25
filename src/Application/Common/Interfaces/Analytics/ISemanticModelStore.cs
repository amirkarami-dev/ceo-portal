using Mabhas19.Application.Analytics.SemanticModels;

namespace Mabhas19.Application.Common.Interfaces.Analytics;

/// <summary>Provides access to the catalogue of available semantic models.</summary>
public interface ISemanticModelStore
{
    Task<IReadOnlyList<SemanticModelDto>> GetAllAsync(CancellationToken cancellationToken = default);

    Task<SemanticModelDto?> GetByIdAsync(string modelKey, CancellationToken cancellationToken = default);

    /// <summary>Looks up a model by its <see cref="SemanticModelDto.Source"/> key (e.g. "projects", "sales", "finance").</summary>
    Task<SemanticModelDto?> GetBySourceAsync(string source, CancellationToken cancellationToken = default);
}
