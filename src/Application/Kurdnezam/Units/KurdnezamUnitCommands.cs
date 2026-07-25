using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Kurdnezam;

namespace Mabhas19.Application.Kurdnezam.Units;

/// <summary>Fields an administrator may set on a unit. Shared by create and update.</summary>
public sealed record KurdnezamUnitInput(
    string Title,
    string Description,
    string? HeadName = null,
    string? HeadRole = null,
    int SortOrder = 0);

// ── create ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record CreateKurdnezamUnitCommand(KurdnezamUnitInput Input) : IRequest<int>;

public class CreateKurdnezamUnitCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateKurdnezamUnitCommand, int>
{
    public async Task<int> Handle(CreateKurdnezamUnitCommand request, CancellationToken cancellationToken)
    {
        var i = request.Input;

        var entity = new KurdnezamUnit
        {
            Title = i.Title,
            Description = i.Description,
            HeadName = i.HeadName,
            HeadRole = i.HeadRole,
            SortOrder = i.SortOrder
        };

        context.KurdnezamUnits.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

public class CreateKurdnezamUnitCommandValidator : AbstractValidator<CreateKurdnezamUnitCommand>
{
    public CreateKurdnezamUnitCommandValidator()
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamUnitInputValidator());
    }
}

// ── update ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record UpdateKurdnezamUnitCommand(int Id, KurdnezamUnitInput Input) : IRequest;

public class UpdateKurdnezamUnitCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateKurdnezamUnitCommand>
{
    public async Task Handle(UpdateKurdnezamUnitCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamUnits
            .FirstOrDefaultAsync(u => u.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        var i = request.Input;

        entity.Title = i.Title;
        entity.Description = i.Description;
        entity.HeadName = i.HeadName;
        entity.HeadRole = i.HeadRole;
        entity.SortOrder = i.SortOrder;

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateKurdnezamUnitCommandValidator : AbstractValidator<UpdateKurdnezamUnitCommand>
{
    public UpdateKurdnezamUnitCommandValidator()
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamUnitInputValidator());
    }
}

// ── delete ───────────────────────────────────────────────────────────────────

// Safe to delete outright: the only inbound reference is KurdnezamNews.UnitId, configured as SetNull.
[Authorize(Roles = Roles.Administrator)]
public record DeleteKurdnezamUnitCommand(int Id) : IRequest;

public class DeleteKurdnezamUnitCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteKurdnezamUnitCommand>
{
    public async Task Handle(DeleteKurdnezamUnitCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamUnits
            .FirstOrDefaultAsync(u => u.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        context.KurdnezamUnits.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── shared input validation ──────────────────────────────────────────────────

public class KurdnezamUnitInputValidator : AbstractValidator<KurdnezamUnitInput>
{
    public KurdnezamUnitInputValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Description).NotEmpty();
        RuleFor(x => x.HeadName).MaximumLength(200);
        RuleFor(x => x.HeadRole).MaximumLength(200);
    }
}
