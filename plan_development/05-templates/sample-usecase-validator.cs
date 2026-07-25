// Sample FluentValidation validator — copy next to the command at
//   src/Application/<Feature>/Commands/<Name>/<Name>CommandValidator.cs
//
// Replace:
//   <RootName>  — .NET namespace root (e.g. MyApp)
//   <Feature>   — feature folder (e.g. Projects)
//   <Name>      — command name (e.g. CreateProject)
//
// Validators inherit AbstractValidator<T> and are auto-discovered (AddValidatorsFromAssembly)
// and run by ValidationBehaviour BEFORE the handler. A failed rule throws the app's
// ValidationException, which ProblemDetailsExceptionHandler turns into a 400 with a per-field
// `errors` map (keyed by property name). AbstractValidator is in scope via a global using.
namespace <RootName>.Application.<Feature>.Commands.<Name>;

public class <Name>CommandValidator : AbstractValidator<<Name>Command>
{
    public <Name>CommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.SomeNumber).GreaterThanOrEqualTo(0);
        RuleFor(x => x.SomeCount).GreaterThanOrEqualTo(0);
    }
}
