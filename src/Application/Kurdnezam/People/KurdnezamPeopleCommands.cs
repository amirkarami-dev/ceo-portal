using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Kurdnezam;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.People;

/// <summary>Fields an administrator may set on a person. Shared by create and update.</summary>
public sealed record KurdnezamPersonInput(
    string Name,
    string Role,
    string Group,
    int SortOrder,
    string? Image = null);

// ── create ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record CreateKurdnezamPersonCommand(KurdnezamPersonInput Input) : IRequest<int>;

public class CreateKurdnezamPersonCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateKurdnezamPersonCommand, int>
{
    public async Task<int> Handle(CreateKurdnezamPersonCommand request, CancellationToken cancellationToken)
    {
        var i = request.Input;

        var entity = new KurdnezamPerson
        {
            Name = i.Name,
            Role = i.Role,
            Image = i.Image,
            Group = i.Group,
            SortOrder = i.SortOrder
        };

        context.KurdnezamPeople.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

public class CreateKurdnezamPersonCommandValidator : AbstractValidator<CreateKurdnezamPersonCommand>
{
    public CreateKurdnezamPersonCommandValidator()
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamPersonInputValidator());
    }
}

// ── update ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record UpdateKurdnezamPersonCommand(int Id, KurdnezamPersonInput Input) : IRequest;

public class UpdateKurdnezamPersonCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateKurdnezamPersonCommand>
{
    public async Task Handle(UpdateKurdnezamPersonCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamPeople
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        var i = request.Input;

        entity.Name = i.Name;
        entity.Role = i.Role;
        entity.Image = i.Image;
        entity.Group = i.Group;
        entity.SortOrder = i.SortOrder;

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateKurdnezamPersonCommandValidator : AbstractValidator<UpdateKurdnezamPersonCommand>
{
    public UpdateKurdnezamPersonCommandValidator()
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamPersonInputValidator());
    }
}

// ── delete ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record DeleteKurdnezamPersonCommand(int Id) : IRequest;

public class DeleteKurdnezamPersonCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteKurdnezamPersonCommand>
{
    public async Task Handle(DeleteKurdnezamPersonCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamPeople
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        context.KurdnezamPeople.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── shared input validation ──────────────────────────────────────────────────

public class KurdnezamPersonInputValidator : AbstractValidator<KurdnezamPersonInput>
{
    public KurdnezamPersonInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Role).NotEmpty().MaximumLength(200);

        // Image is optional. The `!` keeps the rule builder on the non-nullable string overload
        // (a `string?` builder would trip CS8620, and warnings are errors here); the length
        // validator already treats null as valid, so an absent image still passes.
        RuleFor(x => x.Image!).MaximumLength(1000);

        // Group is a route slug on the public site, so it must stay inside the known set.
        RuleFor(x => x.Group)
            .NotEmpty()
            .MaximumLength(50)
            .Must(KurdnezamPersonGroups.IsValid)
            .WithMessage($"Group must be one of: {string.Join(", ", KurdnezamPersonGroups.All)}.");

        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
    }
}
