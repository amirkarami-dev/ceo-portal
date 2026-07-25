namespace Mabhas19.Application.Analytics.AiProviders.Commands.UpsertAiProvider;

public class UpsertAiProviderCommandValidator : AbstractValidator<UpsertAiProviderCommand>
{
    private static readonly string[] AllowedTypes = ["openai", "azure", "anthropic", "arvan", "custom"];

    public UpsertAiProviderCommandValidator()
    {
        RuleFor(x => x.Type)
            .NotEmpty()
            .MaximumLength(100)
            .Must(t => AllowedTypes.Contains(t))
            .WithMessage($"Type must be one of: {string.Join(", ", AllowedTypes)}.");
        RuleFor(x => x.Config).NotNull();
    }
}
