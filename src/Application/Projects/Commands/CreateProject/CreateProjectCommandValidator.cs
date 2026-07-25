namespace Mabhas19.Application.Projects.Commands.CreateProject;

public class CreateProjectCommandValidator : AbstractValidator<CreateProjectCommand>
{
    public CreateProjectCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.City).NotEmpty().MaximumLength(100);
        RuleFor(x => x.TotalArea).GreaterThanOrEqualTo(0);
        RuleFor(x => x.FloorCount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.UnitCount).GreaterThanOrEqualTo(0);
    }
}
