using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Analytics;
using Mabhas19.Application.Common.Security;

namespace Mabhas19.Application.Analytics.Reports.Queries.GenerateReport;

[Authorize]
public record GenerateReportQuery(string Prompt, string SemanticModelId) : IRequest<ReportDefinitionDto>;

public class GenerateReportQueryHandler : IRequestHandler<GenerateReportQuery, ReportDefinitionDto>
{
    private readonly IReportAiService _aiService;
    private readonly IAuditLogger _audit;
    private readonly IUser _user;

    public GenerateReportQueryHandler(IReportAiService aiService, IAuditLogger audit, IUser user)
    {
        _aiService = aiService;
        _audit     = audit;
        _user      = user;
    }

    public async Task<ReportDefinitionDto> Handle(GenerateReportQuery request, CancellationToken cancellationToken)
    {
        var result = await _aiService.GenerateAsync(request.Prompt, request.SemanticModelId, cancellationToken);

        // Fire-and-forget style: AuditLogger swallows its own exceptions.
        await _audit.LogAsync(
            "ai.generate",
            _user.Id,
            new { semanticModelId = request.SemanticModelId, status = "success" },
            cancellationToken);

        return result;
    }
}
