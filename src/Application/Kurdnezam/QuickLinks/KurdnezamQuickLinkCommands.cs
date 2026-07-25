using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Kurdnezam;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.QuickLinks;

/// <summary>Fields an administrator may set on a quick link. Shared by create and update.</summary>
public sealed record KurdnezamQuickLinkInput(
    string Title,
    string Href,
    string Icon,
    int SortOrder);

// ── create ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record CreateKurdnezamQuickLinkCommand(KurdnezamQuickLinkInput Input) : IRequest<int>;

public class CreateKurdnezamQuickLinkCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateKurdnezamQuickLinkCommand, int>
{
    public async Task<int> Handle(CreateKurdnezamQuickLinkCommand request, CancellationToken cancellationToken)
    {
        var i = request.Input;

        var entity = new KurdnezamQuickLink
        {
            Title = i.Title,
            Href = i.Href,
            Icon = i.Icon,
            SortOrder = i.SortOrder
        };

        context.KurdnezamQuickLinks.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

public class CreateKurdnezamQuickLinkCommandValidator : AbstractValidator<CreateKurdnezamQuickLinkCommand>
{
    public CreateKurdnezamQuickLinkCommandValidator()
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamQuickLinkInputValidator());
    }
}

// ── update ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record UpdateKurdnezamQuickLinkCommand(int Id, KurdnezamQuickLinkInput Input) : IRequest;

public class UpdateKurdnezamQuickLinkCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateKurdnezamQuickLinkCommand>
{
    public async Task Handle(UpdateKurdnezamQuickLinkCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamQuickLinks
            .FirstOrDefaultAsync(l => l.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        var i = request.Input;

        entity.Title = i.Title;
        entity.Href = i.Href;
        entity.Icon = i.Icon;
        entity.SortOrder = i.SortOrder;

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateKurdnezamQuickLinkCommandValidator : AbstractValidator<UpdateKurdnezamQuickLinkCommand>
{
    public UpdateKurdnezamQuickLinkCommandValidator()
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamQuickLinkInputValidator());
    }
}

// ── delete ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record DeleteKurdnezamQuickLinkCommand(int Id) : IRequest;

public class DeleteKurdnezamQuickLinkCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteKurdnezamQuickLinkCommand>
{
    public async Task Handle(DeleteKurdnezamQuickLinkCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamQuickLinks
            .FirstOrDefaultAsync(l => l.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        context.KurdnezamQuickLinks.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── shared input validation ──────────────────────────────────────────────────

public class KurdnezamQuickLinkInputValidator : AbstractValidator<KurdnezamQuickLinkInput>
{
    public KurdnezamQuickLinkInputValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Href).NotEmpty().MaximumLength(1000);

        // The icon key is a contract with the frontend's lucide map — reject anything it cannot render.
        RuleFor(x => x.Icon)
            .Must(KurdnezamIcons.IsValid)
            .WithMessage($"Icon must be one of: {string.Join(", ", KurdnezamIcons.All)}.");
    }
}
