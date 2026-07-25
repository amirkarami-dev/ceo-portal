using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Kurdnezam;

namespace Mabhas19.Application.Kurdnezam.FooterLinks;

/// <summary>Fields an administrator may set on a footer link. Shared by create and update.</summary>
public sealed record KurdnezamFooterLinkInput(
    string Title,
    string Href,
    int SortOrder);

// ── create ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record CreateKurdnezamFooterLinkCommand(KurdnezamFooterLinkInput Input) : IRequest<int>;

public class CreateKurdnezamFooterLinkCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateKurdnezamFooterLinkCommand, int>
{
    public async Task<int> Handle(CreateKurdnezamFooterLinkCommand request, CancellationToken cancellationToken)
    {
        var i = request.Input;

        var entity = new KurdnezamFooterLink
        {
            Title = i.Title,
            Href = i.Href,
            SortOrder = i.SortOrder
        };

        context.KurdnezamFooterLinks.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

public class CreateKurdnezamFooterLinkCommandValidator : AbstractValidator<CreateKurdnezamFooterLinkCommand>
{
    public CreateKurdnezamFooterLinkCommandValidator()
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamFooterLinkInputValidator());
    }
}

// ── update ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record UpdateKurdnezamFooterLinkCommand(int Id, KurdnezamFooterLinkInput Input) : IRequest;

public class UpdateKurdnezamFooterLinkCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateKurdnezamFooterLinkCommand>
{
    public async Task Handle(UpdateKurdnezamFooterLinkCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamFooterLinks
            .FirstOrDefaultAsync(l => l.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        var i = request.Input;

        entity.Title = i.Title;
        entity.Href = i.Href;
        entity.SortOrder = i.SortOrder;

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateKurdnezamFooterLinkCommandValidator : AbstractValidator<UpdateKurdnezamFooterLinkCommand>
{
    public UpdateKurdnezamFooterLinkCommandValidator()
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamFooterLinkInputValidator());
    }
}

// ── delete ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record DeleteKurdnezamFooterLinkCommand(int Id) : IRequest;

public class DeleteKurdnezamFooterLinkCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteKurdnezamFooterLinkCommand>
{
    public async Task Handle(DeleteKurdnezamFooterLinkCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamFooterLinks
            .FirstOrDefaultAsync(l => l.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        context.KurdnezamFooterLinks.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── shared input validation ──────────────────────────────────────────────────

public class KurdnezamFooterLinkInputValidator : AbstractValidator<KurdnezamFooterLinkInput>
{
    public KurdnezamFooterLinkInputValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Href).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
    }
}
