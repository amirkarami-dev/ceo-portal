namespace Mabhas19.Application.Analytics.Reports.Commands.UpdateReport;

public class UpdateReportCommandValidator : AbstractValidator<UpdateReportCommand>
{
    public UpdateReportCommandValidator()
    {
        RuleFor(x => x.Id).GreaterThan(0);
        RuleFor(x => x.Definition).NotNull();

        // The definition's name becomes the AnalyticsReport.Name column, so an empty one would blank
        // the report's title in the library list as well as in the viewer.
        RuleFor(x => x.Definition.Name)
            .NotEmpty()
            .MaximumLength(200)
            .When(x => x.Definition is not null);

        RuleFor(x => x.Definition.Dataset)
            .NotEmpty()
            .When(x => x.Definition is not null);

        RuleFor(x => x.Visibility)
            .Must(v => v is "private" or "tenant")
            .WithMessage("Visibility must be 'private' or 'tenant'.")
            .When(x => !string.IsNullOrWhiteSpace(x.Visibility));
    }
}
