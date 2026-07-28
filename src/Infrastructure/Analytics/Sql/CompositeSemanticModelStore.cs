using Mabhas19.Application.Analytics.SemanticModels;
using Mabhas19.Application.Common.Interfaces.Analytics;

namespace Mabhas19.Infrastructure.Analytics.Sql;

/// <summary>
/// Presents several semantic model stores as one catalogue, so the report builder can offer
/// datasets that live in different databases — the KurdNezam warehouse and this application's own
/// CeoDb — without the caller knowing which is which. Each model carries its own connection
/// (<see cref="SemanticModelDto.ConnectionName"/>); the engine resolves it per query.
///
/// Order matters only for duplicate keys: the FIRST store that claims a model key or source wins,
/// so the KurdNezam catalogue stays authoritative if a key is ever added twice by mistake.
/// </summary>
internal sealed class CompositeSemanticModelStore : ISemanticModelStore
{
    private readonly IReadOnlyList<ISemanticModelStore> _stores;

    public CompositeSemanticModelStore(IEnumerable<ISemanticModelStore> stores)
        => _stores = stores.ToList();

    public async Task<IReadOnlyList<SemanticModelDto>> GetAllAsync(CancellationToken cancellationToken = default)
    {
        var all = new List<SemanticModelDto>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var store in _stores)
        {
            foreach (var model in await store.GetAllAsync(cancellationToken))
            {
                if (seen.Add(model.ModelKey))
                {
                    all.Add(model);
                }
            }
        }

        return all;
    }

    public async Task<SemanticModelDto?> GetByIdAsync(string modelKey, CancellationToken cancellationToken = default)
    {
        foreach (var store in _stores)
        {
            var model = await store.GetByIdAsync(modelKey, cancellationToken);
            if (model is not null)
            {
                return model;
            }
        }

        return null;
    }

    public async Task<SemanticModelDto?> GetBySourceAsync(string source, CancellationToken cancellationToken = default)
    {
        foreach (var store in _stores)
        {
            var model = await store.GetBySourceAsync(source, cancellationToken);
            if (model is not null)
            {
                return model;
            }
        }

        return null;
    }
}
