using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Kurdnezam;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.ContactSections;

/// <summary>Fields an administrator may set on a contact section. Shared by create and update.</summary>
public sealed record KurdnezamContactSectionInput(
    string Title,
    string? Description,
    string? Icon,
    int SortOrder,
    bool IsActive = true);

/// <summary>Fields an administrator may set on a channel. Shared by create and update.</summary>
public sealed record KurdnezamContactChannelInput(
    string Kind,
    string? Label,
    string Value,
    int SortOrder);

// ── create section ───────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record CreateKurdnezamContactSectionCommand(KurdnezamContactSectionInput Input) : IRequest<int>;

public class CreateKurdnezamContactSectionCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateKurdnezamContactSectionCommand, int>
{
    public async Task<int> Handle(CreateKurdnezamContactSectionCommand request, CancellationToken cancellationToken)
    {
        var i = request.Input;

        var entity = new KurdnezamContactSection
        {
            Title = i.Title,
            Description = i.Description,
            Icon = i.Icon,
            SortOrder = i.SortOrder,
            IsActive = i.IsActive
        };

        context.KurdnezamContactSections.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

public class CreateKurdnezamContactSectionCommandValidator : AbstractValidator<CreateKurdnezamContactSectionCommand>
{
    public CreateKurdnezamContactSectionCommandValidator()
        => RuleFor(x => x.Input).SetValidator(new KurdnezamContactSectionInputValidator());
}

// ── update section ───────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record UpdateKurdnezamContactSectionCommand(int Id, KurdnezamContactSectionInput Input) : IRequest;

public class UpdateKurdnezamContactSectionCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateKurdnezamContactSectionCommand>
{
    public async Task Handle(UpdateKurdnezamContactSectionCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamContactSections
            .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        var i = request.Input;

        entity.Title = i.Title;
        entity.Description = i.Description;
        entity.Icon = i.Icon;
        entity.SortOrder = i.SortOrder;
        entity.IsActive = i.IsActive;

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateKurdnezamContactSectionCommandValidator : AbstractValidator<UpdateKurdnezamContactSectionCommand>
{
    public UpdateKurdnezamContactSectionCommandValidator()
        => RuleFor(x => x.Input).SetValidator(new KurdnezamContactSectionInputValidator());
}

// ── delete section ───────────────────────────────────────────────────────────

/// <summary>
/// Takes the section's channels with it (cascade), but <b>not</b> the messages sent to it — that FK
/// is <c>SET NULL</c>, so the inbox keeps its history.
/// </summary>
[Authorize(Roles = Roles.Administrator)]
public record DeleteKurdnezamContactSectionCommand(int Id) : IRequest;

public class DeleteKurdnezamContactSectionCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteKurdnezamContactSectionCommand>
{
    public async Task Handle(DeleteKurdnezamContactSectionCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamContactSections
            .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        context.KurdnezamContactSections.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── create channel ───────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record CreateKurdnezamContactChannelCommand(int SectionId, KurdnezamContactChannelInput Input) : IRequest<int>;

public class CreateKurdnezamContactChannelCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateKurdnezamContactChannelCommand, int>
{
    public async Task<int> Handle(CreateKurdnezamContactChannelCommand request, CancellationToken cancellationToken)
    {
        var section = await context.KurdnezamContactSections
            .FirstOrDefaultAsync(s => s.Id == request.SectionId, cancellationToken);

        Guard.Against.NotFound(request.SectionId, section);

        var i = request.Input;

        var entity = new KurdnezamContactChannel
        {
            SectionId = section.Id,
            Kind = i.Kind,
            Label = i.Label,
            Value = i.Value,
            SortOrder = i.SortOrder
        };

        context.KurdnezamContactChannels.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

public class CreateKurdnezamContactChannelCommandValidator : AbstractValidator<CreateKurdnezamContactChannelCommand>
{
    public CreateKurdnezamContactChannelCommandValidator()
        => RuleFor(x => x.Input).SetValidator(new KurdnezamContactChannelInputValidator());
}

// ── update channel ───────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record UpdateKurdnezamContactChannelCommand(int ChannelId, KurdnezamContactChannelInput Input) : IRequest;

public class UpdateKurdnezamContactChannelCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateKurdnezamContactChannelCommand>
{
    public async Task Handle(UpdateKurdnezamContactChannelCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamContactChannels
            .FirstOrDefaultAsync(c => c.Id == request.ChannelId, cancellationToken);

        Guard.Against.NotFound(request.ChannelId, entity);

        var i = request.Input;

        entity.Kind = i.Kind;
        entity.Label = i.Label;
        entity.Value = i.Value;
        entity.SortOrder = i.SortOrder;

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateKurdnezamContactChannelCommandValidator : AbstractValidator<UpdateKurdnezamContactChannelCommand>
{
    public UpdateKurdnezamContactChannelCommandValidator()
        => RuleFor(x => x.Input).SetValidator(new KurdnezamContactChannelInputValidator());
}

// ── delete channel ───────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record DeleteKurdnezamContactChannelCommand(int ChannelId) : IRequest;

public class DeleteKurdnezamContactChannelCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteKurdnezamContactChannelCommand>
{
    public async Task Handle(DeleteKurdnezamContactChannelCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamContactChannels
            .FirstOrDefaultAsync(c => c.Id == request.ChannelId, cancellationToken);

        Guard.Against.NotFound(request.ChannelId, entity);

        context.KurdnezamContactChannels.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── shared input validation ──────────────────────────────────────────────────

public class KurdnezamContactSectionInputValidator : AbstractValidator<KurdnezamContactSectionInput>
{
    public KurdnezamContactSectionInputValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Description).MaximumLength(500);

        RuleFor(x => x.Icon)
            .MaximumLength(50)
            .Must(icon => string.IsNullOrEmpty(icon) || KurdnezamContactIcons.IsValid(icon))
            .WithMessage("The selected icon is not one the site can draw.");
    }
}

public class KurdnezamContactChannelInputValidator : AbstractValidator<KurdnezamContactChannelInput>
{
    public KurdnezamContactChannelInputValidator()
    {
        // Checked here as well as by the database CHECK constraint: a validator gives the admin a
        // readable message, the constraint stops anything that arrives another way.
        RuleFor(x => x.Kind)
            .NotEmpty()
            .Must(KurdnezamContactChannelKinds.IsValid)
            .WithMessage($"Kind must be one of: {string.Join(", ", KurdnezamContactChannelKinds.All)}.");

        RuleFor(x => x.Label).MaximumLength(200);
        RuleFor(x => x.Value).NotEmpty().MaximumLength(1000);
    }
}
