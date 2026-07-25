using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Kurdnezam;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.Slides;

/// <summary>Fields an administrator may set on a slide. Shared by create and update.</summary>
public sealed record KurdnezamSlideInput(
    string Title,
    string Subtitle,
    string Image,
    int NewsId,
    string Badge,
    int SortOrder);

// ── create ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record CreateKurdnezamSlideCommand(KurdnezamSlideInput Input) : IRequest<int>;

public class CreateKurdnezamSlideCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateKurdnezamSlideCommand, int>
{
    public async Task<int> Handle(CreateKurdnezamSlideCommand request, CancellationToken cancellationToken)
    {
        var i = request.Input;

        var entity = new KurdnezamSlide
        {
            Title = i.Title,
            Subtitle = i.Subtitle,
            Image = i.Image,
            NewsId = i.NewsId,
            Badge = i.Badge,
            SortOrder = i.SortOrder
        };

        context.KurdnezamSlides.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

public class CreateKurdnezamSlideCommandValidator : AbstractValidator<CreateKurdnezamSlideCommand>
{
    public CreateKurdnezamSlideCommandValidator(IApplicationDbContext context)
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamSlideInputValidator(context));
    }
}

// ── update ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record UpdateKurdnezamSlideCommand(int Id, KurdnezamSlideInput Input) : IRequest;

public class UpdateKurdnezamSlideCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateKurdnezamSlideCommand>
{
    public async Task Handle(UpdateKurdnezamSlideCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamSlides
            .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        var i = request.Input;

        entity.Title = i.Title;
        entity.Subtitle = i.Subtitle;
        entity.Image = i.Image;
        entity.NewsId = i.NewsId;
        entity.Badge = i.Badge;
        entity.SortOrder = i.SortOrder;

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateKurdnezamSlideCommandValidator : AbstractValidator<UpdateKurdnezamSlideCommand>
{
    public UpdateKurdnezamSlideCommandValidator(IApplicationDbContext context)
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamSlideInputValidator(context));
    }
}

// ── delete ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record DeleteKurdnezamSlideCommand(int Id) : IRequest;

public class DeleteKurdnezamSlideCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteKurdnezamSlideCommand>
{
    public async Task Handle(DeleteKurdnezamSlideCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamSlides
            .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        context.KurdnezamSlides.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── shared input validation ──────────────────────────────────────────────────

public class KurdnezamSlideInputValidator : AbstractValidator<KurdnezamSlideInput>
{
    public KurdnezamSlideInputValidator(IApplicationDbContext context)
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Subtitle).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Image).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.Badge).NotEmpty().MaximumLength(200);

        // The FK is Restrict, so a bad NewsId would surface as a DbUpdateException (500) instead
        // of a validation error — check it up front.
        RuleFor(x => x.NewsId)
            .MustAsync(async (id, ct) => await context.KurdnezamNews.AnyAsync(n => n.Id == id, ct))
            .WithMessage("The selected news article does not exist.");
    }
}
