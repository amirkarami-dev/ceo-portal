using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Kurdnezam;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.Contact;

/// <summary>Fields the public contact form submits.</summary>
public sealed record KurdnezamContactMessageInput(
    string Name,
    string Phone,
    string Subject,
    string Message);

/// <summary>Body of the admin read/unread toggle.</summary>
public sealed record KurdnezamContactMessageReadInput(bool IsRead);

// ── create ───────────────────────────────────────────────────────────────────

/// <remarks>
/// Deliberately unauthenticated — this is the public contact form. The message lands in the admin
/// inbox unread; it grants the sender nothing.
/// </remarks>
public record CreateKurdnezamContactMessageCommand(KurdnezamContactMessageInput Input) : IRequest<int>;

public class CreateKurdnezamContactMessageCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateKurdnezamContactMessageCommand, int>
{
    public async Task<int> Handle(CreateKurdnezamContactMessageCommand request, CancellationToken cancellationToken)
    {
        var i = request.Input;

        var entity = new KurdnezamContactMessage
        {
            Name = i.Name,
            Phone = i.Phone,
            Subject = i.Subject,
            Message = i.Message,
            IsRead = false
        };

        context.KurdnezamContactMessages.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

public class CreateKurdnezamContactMessageCommandValidator : AbstractValidator<CreateKurdnezamContactMessageCommand>
{
    public CreateKurdnezamContactMessageCommandValidator()
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamContactMessageInputValidator());
    }
}

// ── mark read / unread ───────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record SetKurdnezamContactMessageReadCommand(int Id, bool IsRead) : IRequest;

public class SetKurdnezamContactMessageReadCommandHandler(IApplicationDbContext context)
    : IRequestHandler<SetKurdnezamContactMessageReadCommand>
{
    public async Task Handle(SetKurdnezamContactMessageReadCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamContactMessages
            .FirstOrDefaultAsync(m => m.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        entity.IsRead = request.IsRead;

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class SetKurdnezamContactMessageReadCommandValidator : AbstractValidator<SetKurdnezamContactMessageReadCommand>
{
    public SetKurdnezamContactMessageReadCommandValidator()
    {
        RuleFor(x => x.Id).GreaterThan(0);
    }
}

// ── delete ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record DeleteKurdnezamContactMessageCommand(int Id) : IRequest;

public class DeleteKurdnezamContactMessageCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteKurdnezamContactMessageCommand>
{
    public async Task Handle(DeleteKurdnezamContactMessageCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamContactMessages
            .FirstOrDefaultAsync(m => m.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        context.KurdnezamContactMessages.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── shared input validation ──────────────────────────────────────────────────

public class KurdnezamContactMessageInputValidator : AbstractValidator<KurdnezamContactMessageInput>
{
    public KurdnezamContactMessageInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Phone).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Subject).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Message).NotEmpty();
    }
}
