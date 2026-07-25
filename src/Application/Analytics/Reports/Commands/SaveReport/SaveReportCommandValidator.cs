namespace Mabhas19.Application.Analytics.Reports.Commands.SaveReport;

public class SaveReportCommandValidator : AbstractValidator<SaveReportCommand>
{
    private static readonly string[] AllowedVisibilities = ["private", "tenant"];

    public SaveReportCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(300);

        RuleFor(x => x.Visibility)
            .NotEmpty()
            .Must(v => AllowedVisibilities.Contains(v))
            .WithMessage("Visibility must be 'private' or 'tenant'.");

        RuleFor(x => x.Definition)
            .NotNull();

        RuleFor(x => x.Definition.Dataset)
            .NotEmpty()
            .MaximumLength(200)
            .When(x => x.Definition != null);
    }
}
