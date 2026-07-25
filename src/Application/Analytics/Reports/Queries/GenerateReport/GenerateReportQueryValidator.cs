namespace Mabhas19.Application.Analytics.Reports.Queries.GenerateReport;

public class GenerateReportQueryValidator : AbstractValidator<GenerateReportQuery>
{
    public GenerateReportQueryValidator()
    {
        RuleFor(x => x.Prompt)
            .NotEmpty()
            .MaximumLength(2000);

        RuleFor(x => x.SemanticModelId)
            .NotEmpty()
            .MaximumLength(200);
    }
}
