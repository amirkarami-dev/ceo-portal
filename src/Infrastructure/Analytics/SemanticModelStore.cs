using Mabhas19.Application.Analytics.SemanticModels;
using Mabhas19.Application.Common.Interfaces.Analytics;

namespace Mabhas19.Infrastructure.Analytics;

/// <summary>
/// Static catalogue of the three bundled semantic models, ported from
/// <c>analytics-web/src/semantic/models/{project,sales,finance}.ts</c>.
/// </summary>
internal sealed class SemanticModelStore : ISemanticModelStore
{
    private static readonly IReadOnlyList<SemanticModelDto> Catalogue = BuildCatalogue();

    public Task<IReadOnlyList<SemanticModelDto>> GetAllAsync(CancellationToken cancellationToken = default)
        => Task.FromResult(Catalogue);

    public Task<SemanticModelDto?> GetByIdAsync(string modelKey, CancellationToken cancellationToken = default)
    {
        var model = Catalogue.FirstOrDefault(m =>
            string.Equals(m.ModelKey, modelKey, StringComparison.OrdinalIgnoreCase));
        return Task.FromResult(model);
    }

    public Task<SemanticModelDto?> GetBySourceAsync(string source, CancellationToken cancellationToken = default)
    {
        var model = Catalogue.FirstOrDefault(m =>
            string.Equals(m.Source, source, StringComparison.OrdinalIgnoreCase));
        return Task.FromResult(model);
    }

    // ------------------------------------------------------------------
    // Static catalogue — mirroring the TypeScript semantic models
    // ------------------------------------------------------------------

    private static IReadOnlyList<SemanticModelDto> BuildCatalogue() =>
    [
        // ------ Projects ------
        new SemanticModelDto
        {
            ModelKey    = "model-project",
            Name        = "Projects",
            Description = "Construction projects",
            Source      = "projects",
            Fields      =
            [
                new SemanticFieldDto { Id = "id",            Name = "ID",              Type = "string", Role = "dimension" },
                new SemanticFieldDto { Id = "name",          Name = "Project Name",    Type = "string", Role = "dimension" },
                new SemanticFieldDto { Id = "province",      Name = "Province",        Type = "string", Role = "dimension" },
                new SemanticFieldDto { Id = "status",        Name = "Status",          Type = "string", Role = "dimension" },
                new SemanticFieldDto { Id = "buildingGroup", Name = "Building Group",  Type = "string", Role = "dimension" },
                new SemanticFieldDto { Id = "area",          Column = "areaM2",        Name = "Area (m²)",       Type = "number", Role = "measure"   },
                new SemanticFieldDto { Id = "score",         Name = "Assessment Score",Type = "number", Role = "measure"   },
                new SemanticFieldDto { Id = "delayDays",     Name = "Delay (days)",    Type = "number", Role = "measure"   },
                new SemanticFieldDto { Id = "startDate",     Name = "Start Date",      Type = "date",   Role = "date"      },
                new SemanticFieldDto { Id = "dueDate",       Name = "Due Date",        Type = "date",   Role = "date"      },
            ],
        },

        // ------ Sales ------
        new SemanticModelDto
        {
            ModelKey    = "model-sales",
            Name        = "Sales",
            Description = "Sales orders",
            Source      = "sales",
            Fields      =
            [
                new SemanticFieldDto { Id = "orderId",      Name = "Order ID",      Type = "string", Role = "dimension" },
                new SemanticFieldDto { Id = "customerName", Name = "Customer",      Type = "string", Role = "dimension" },
                new SemanticFieldDto { Id = "product",      Name = "Product",       Type = "string", Role = "dimension" },
                new SemanticFieldDto { Id = "category",     Name = "Category",      Type = "string", Role = "dimension" },
                new SemanticFieldDto { Id = "province",     Name = "Province",      Type = "string", Role = "dimension" },
                new SemanticFieldDto { Id = "channel",      Name = "Channel",       Type = "string", Role = "dimension" },
                new SemanticFieldDto { Id = "status",       Name = "Status",        Type = "string", Role = "dimension" },
                new SemanticFieldDto { Id = "quantity",     Column = "qty",         Name = "Quantity",      Type = "number", Role = "measure"   },
                new SemanticFieldDto { Id = "amount",       Name = "Revenue",       Type = "number", Role = "measure"   },
                new SemanticFieldDto { Id = "orderDate",    Name = "Order Date",    Type = "date",   Role = "date"      },
            ],
        },

        // ------ Finance ------
        new SemanticModelDto
        {
            ModelKey    = "model-finance",
            Name        = "Finance",
            Description = "Financial transactions",
            Source      = "finance",
            Fields      =
            [
                new SemanticFieldDto { Id = "txnId",      Name = "Transaction ID", Type = "string", Role = "dimension" },
                new SemanticFieldDto { Id = "account",    Name = "Account",        Type = "string", Role = "dimension" },
                new SemanticFieldDto { Id = "costCenter", Name = "Cost Center",    Type = "string", Role = "dimension" },
                new SemanticFieldDto { Id = "type",       Name = "Type",           Type = "string", Role = "dimension" },
                new SemanticFieldDto { Id = "amount",     Name = "Amount",         Type = "number", Role = "measure"   },
                new SemanticFieldDto { Id = "marginPct",  Name = "Margin %",       Type = "number", Role = "measure"   },
                new SemanticFieldDto { Id = "txnDate",    Name = "Date",           Type = "date",   Role = "date"      },
            ],
        },
    ];
}
