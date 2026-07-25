namespace Mabhas19.Application.Projects.Commands.UpdateProject;

public class UpdateProjectCommandValidator : AbstractValidator<UpdateProjectCommand>
{
    public UpdateProjectCommandValidator()
    {
        RuleFor(x => x.Id).GreaterThan(0);
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.City).NotEmpty().MaximumLength(100);
        RuleFor(x => x.TotalArea).GreaterThanOrEqualTo(0);
        RuleFor(x => x.FloorCount).GreaterThanOrEqualTo(0);
        RuleFor(x => x.UnitCount).GreaterThanOrEqualTo(0);
    }
}
