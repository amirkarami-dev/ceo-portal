using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Kurdnezam;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.OrgPages;

/// <summary>Fields an administrator may set on an org page. Shared by create and update.</summary>
public sealed record KurdnezamOrgPageInput(
    string Slug,
    string Title,
    string Intro,
    int SortOrder,
    string? Group = null);

// ── create ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record CreateKurdnezamOrgPageCommand(KurdnezamOrgPageInput Input) : IRequest<int>;

public class CreateKurdnezamOrgPageCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateKurdnezamOrgPageCommand, int>
{
    public async Task<int> Handle(CreateKurdnezamOrgPageCommand request, CancellationToken cancellationToken)
    {
        var i = request.Input;

        var entity = new KurdnezamOrgPage
        {
            Slug = i.Slug,
            Title = i.Title,
            Group = i.Group,
            Intro = i.Intro,
            SortOrder = i.SortOrder
        };

        context.KurdnezamOrgPages.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

public class CreateKurdnezamOrgPageCommandValidator : AbstractValidator<CreateKurdnezamOrgPageCommand>
{
    public CreateKurdnezamOrgPageCommandValidator(IApplicationDbContext context)
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamOrgPageInputValidator());

        RuleFor(x => x.Input.Slug)
            .MustAsync(async (slug, ct) => !await context.KurdnezamOrgPages.AnyAsync(p => p.Slug == slug, ct))
            .WithMessage("An org page with this slug already exists.");
    }
}

// ── update ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record UpdateKurdnezamOrgPageCommand(int Id, KurdnezamOrgPageInput Input) : IRequest;

public class UpdateKurdnezamOrgPageCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateKurdnezamOrgPageCommand>
{
    public async Task Handle(UpdateKurdnezamOrgPageCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamOrgPages
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        var i = request.Input;

        entity.Slug = i.Slug;
        entity.Title = i.Title;
        entity.Group = i.Group;
        entity.Intro = i.Intro;
        entity.SortOrder = i.SortOrder;

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateKurdnezamOrgPageCommandValidator : AbstractValidator<UpdateKurdnezamOrgPageCommand>
{
    public UpdateKurdnezamOrgPageCommandValidator(IApplicationDbContext context)
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamOrgPageInputValidator());

        // Uniqueness must ignore the row being edited, so it lives here rather than in the shared input validator.
        RuleFor(x => x.Input.Slug)
            .MustAsync(async (command, slug, ct) =>
                !await context.KurdnezamOrgPages.AnyAsync(p => p.Slug == slug && p.Id != command.Id, ct))
            .WithMessage("An org page with this slug already exists.");
    }
}

// ── delete ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record DeleteKurdnezamOrgPageCommand(int Id) : IRequest;

public class DeleteKurdnezamOrgPageCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteKurdnezamOrgPageCommand>
{
    public async Task Handle(DeleteKurdnezamOrgPageCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamOrgPages
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        context.KurdnezamOrgPages.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── shared input validation ──────────────────────────────────────────────────

public class KurdnezamOrgPageInputValidator : AbstractValidator<KurdnezamOrgPageInput>
{
    public KurdnezamOrgPageInputValidator()
    {
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Intro).NotEmpty();

        RuleFor(x => x.Group)
            .MaximumLength(50)
            .Must(g => g is null || KurdnezamPersonGroups.IsValid(g))
            .WithMessage("The selected group is not a valid person group.");
    }
}
