namespace Mabhas19.Application.Analytics.Reports.Queries.ExecuteReport;

public class ExecuteReportQueryValidator : AbstractValidator<ExecuteReportQuery>
{
    public ExecuteReportQueryValidator()
    {
        RuleFor(x => x.Definition)
            .NotNull();

        RuleFor(x => x.Definition.Dataset)
            .NotEmpty()
            .MaximumLength(200)
            .When(x => x.Definition != null);
    }
}
