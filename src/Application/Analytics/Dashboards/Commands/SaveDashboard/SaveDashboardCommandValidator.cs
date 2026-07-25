namespace Mabhas19.Application.Analytics.Dashboards.Commands.SaveDashboard;

public class SaveDashboardCommandValidator : AbstractValidator<SaveDashboardCommand>
{
    public SaveDashboardCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Widgets).NotNull();
        RuleFor(x => x.Layout).NotNull();
    }
}
