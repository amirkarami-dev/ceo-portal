using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Kurdnezam;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.TabGroups;

/// <summary>Fields an administrator may set on a tab group. Shared by create and update.</summary>
public sealed record KurdnezamTabGroupInput(
    string Slug,
    string Title,
    int SortOrder);

/// <summary>Fields an administrator may set on a tab item. Shared by create and update.</summary>
public sealed record KurdnezamTabItemInput(
    string Title,
    string? Href,
    string? Note,
    int SortOrder);

// ── create group ─────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record CreateKurdnezamTabGroupCommand(KurdnezamTabGroupInput Input) : IRequest<int>;

public class CreateKurdnezamTabGroupCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateKurdnezamTabGroupCommand, int>
{
    public async Task<int> Handle(CreateKurdnezamTabGroupCommand request, CancellationToken cancellationToken)
    {
        var i = request.Input;

        var entity = new KurdnezamTabGroup
        {
            Slug = i.Slug,
            Title = i.Title,
            SortOrder = i.SortOrder
        };

        context.KurdnezamTabGroups.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

public class CreateKurdnezamTabGroupCommandValidator : AbstractValidator<CreateKurdnezamTabGroupCommand>
{
    public CreateKurdnezamTabGroupCommandValidator(IApplicationDbContext context)
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamTabGroupInputValidator());

        RuleFor(x => x.Input.Slug)
            .MustAsync(async (slug, ct) => !await context.KurdnezamTabGroups.AnyAsync(g => g.Slug == slug, ct))
            .WithMessage("A tab group with this slug already exists.");
    }
}

// ── update group ─────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record UpdateKurdnezamTabGroupCommand(int Id, KurdnezamTabGroupInput Input) : IRequest;

public class UpdateKurdnezamTabGroupCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateKurdnezamTabGroupCommand>
{
    public async Task Handle(UpdateKurdnezamTabGroupCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamTabGroups
            .FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        var i = request.Input;

        entity.Slug = i.Slug;
        entity.Title = i.Title;
        entity.SortOrder = i.SortOrder;

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateKurdnezamTabGroupCommandValidator : AbstractValidator<UpdateKurdnezamTabGroupCommand>
{
    public UpdateKurdnezamTabGroupCommandValidator(IApplicationDbContext context)
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamTabGroupInputValidator());

        RuleFor(x => x.Input.Slug)
            .MustAsync(async (command, slug, ct) =>
                !await context.KurdnezamTabGroups.AnyAsync(g => g.Slug == slug && g.Id != command.Id, ct))
            .WithMessage("A tab group with this slug already exists.");
    }
}

// ── delete group ─────────────────────────────────────────────────────────────

/// <summary>Deleting a group takes its items with it (cascade).</summary>
[Authorize(Roles = Roles.Administrator)]
public record DeleteKurdnezamTabGroupCommand(int Id) : IRequest;

public class DeleteKurdnezamTabGroupCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteKurdnezamTabGroupCommand>
{
    public async Task Handle(DeleteKurdnezamTabGroupCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamTabGroups
            .FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        context.KurdnezamTabGroups.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── create item ──────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record CreateKurdnezamTabItemCommand(int TabGroupId, KurdnezamTabItemInput Input) : IRequest<int>;

public class CreateKurdnezamTabItemCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateKurdnezamTabItemCommand, int>
{
    public async Task<int> Handle(CreateKurdnezamTabItemCommand request, CancellationToken cancellationToken)
    {
        var group = await context.KurdnezamTabGroups
            .FirstOrDefaultAsync(g => g.Id == request.TabGroupId, cancellationToken);

        Guard.Against.NotFound(request.TabGroupId, group);

        var i = request.Input;

        var entity = new KurdnezamTabItem
        {
            TabGroupId = group.Id,
            Title = i.Title,
            Href = i.Href,
            Note = i.Note,
            SortOrder = i.SortOrder
        };

        context.KurdnezamTabItems.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

public class CreateKurdnezamTabItemCommandValidator : AbstractValidator<CreateKurdnezamTabItemCommand>
{
    public CreateKurdnezamTabItemCommandValidator()
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamTabItemInputValidator());
    }
}

// ── update item ──────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record UpdateKurdnezamTabItemCommand(int ItemId, KurdnezamTabItemInput Input) : IRequest;

public class UpdateKurdnezamTabItemCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateKurdnezamTabItemCommand>
{
    public async Task Handle(UpdateKurdnezamTabItemCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamTabItems
            .FirstOrDefaultAsync(x => x.Id == request.ItemId, cancellationToken);

        Guard.Against.NotFound(request.ItemId, entity);

        var i = request.Input;

        entity.Title = i.Title;
        entity.Href = i.Href;
        entity.Note = i.Note;
        entity.SortOrder = i.SortOrder;

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateKurdnezamTabItemCommandValidator : AbstractValidator<UpdateKurdnezamTabItemCommand>
{
    public UpdateKurdnezamTabItemCommandValidator()
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamTabItemInputValidator());
    }
}

// ── delete item ──────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record DeleteKurdnezamTabItemCommand(int ItemId) : IRequest;

public class DeleteKurdnezamTabItemCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteKurdnezamTabItemCommand>
{
    public async Task Handle(DeleteKurdnezamTabItemCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamTabItems
            .FirstOrDefaultAsync(x => x.Id == request.ItemId, cancellationToken);

        Guard.Against.NotFound(request.ItemId, entity);

        context.KurdnezamTabItems.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── shared input validation ──────────────────────────────────────────────────

public class KurdnezamTabGroupInputValidator : AbstractValidator<KurdnezamTabGroupInput>
{
    public KurdnezamTabGroupInputValidator()
    {
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
    }
}

public class KurdnezamTabItemInputValidator : AbstractValidator<KurdnezamTabItemInput>
{
    public KurdnezamTabItemInputValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Href).MaximumLength(1000);
        RuleFor(x => x.Note).MaximumLength(500);
    }
}
