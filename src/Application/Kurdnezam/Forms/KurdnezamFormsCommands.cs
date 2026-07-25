using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Kurdnezam;
using Microsoft.EntityFrameworkCore;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Kurdnezam.Forms;

/// <summary>Fields an administrator may set on a form. Shared by create and update.</summary>
public sealed record KurdnezamFormInput(
    string Title,
    string Note,
    string Deadline,
    string Image,
    bool IsOpen = true,
    int SortOrder = 0);

/// <summary>What a member fills in on the public registration form.</summary>
public sealed record KurdnezamFormSubmissionInput(
    string FullName,
    string NationalId,
    string MembershipNo,
    string Mobile,
    string? Notes = null);

// ── create form ──────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record CreateKurdnezamFormCommand(KurdnezamFormInput Input) : IRequest<int>;

public class CreateKurdnezamFormCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateKurdnezamFormCommand, int>
{
    public async Task<int> Handle(CreateKurdnezamFormCommand request, CancellationToken cancellationToken)
    {
        var i = request.Input;

        var entity = new KurdnezamForm
        {
            Title = i.Title,
            Note = i.Note,
            Deadline = i.Deadline,
            Image = i.Image,
            IsOpen = i.IsOpen,
            SortOrder = i.SortOrder
        };

        context.KurdnezamForms.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

public class CreateKurdnezamFormCommandValidator : AbstractValidator<CreateKurdnezamFormCommand>
{
    public CreateKurdnezamFormCommandValidator()
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamFormInputValidator());
    }
}

// ── update form ──────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record UpdateKurdnezamFormCommand(int Id, KurdnezamFormInput Input) : IRequest;

public class UpdateKurdnezamFormCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateKurdnezamFormCommand>
{
    public async Task Handle(UpdateKurdnezamFormCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamForms
            .FirstOrDefaultAsync(f => f.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        var i = request.Input;

        entity.Title = i.Title;
        entity.Note = i.Note;
        entity.Deadline = i.Deadline;
        entity.Image = i.Image;
        entity.IsOpen = i.IsOpen;
        entity.SortOrder = i.SortOrder;

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateKurdnezamFormCommandValidator : AbstractValidator<UpdateKurdnezamFormCommand>
{
    public UpdateKurdnezamFormCommandValidator()
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamFormInputValidator());
    }
}

// ── delete form ──────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record DeleteKurdnezamFormCommand(int Id) : IRequest;

public class DeleteKurdnezamFormCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteKurdnezamFormCommand>
{
    public async Task Handle(DeleteKurdnezamFormCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamForms
            .FirstOrDefaultAsync(f => f.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        // The submissions go with it — the FK cascades.
        context.KurdnezamForms.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── submit a form (public) ───────────────────────────────────────────────────

/// <summary>
/// A member registering on a form. Deliberately NOT gated: the landing site posts this
/// anonymously. It previously only called <c>preventDefault()</c> and stored nothing.
/// </summary>
public record SubmitKurdnezamFormCommand(int FormId, KurdnezamFormSubmissionInput Input) : IRequest<int>;

public class SubmitKurdnezamFormCommandHandler(IApplicationDbContext context)
    : IRequestHandler<SubmitKurdnezamFormCommand, int>
{
    public async Task<int> Handle(SubmitKurdnezamFormCommand request, CancellationToken cancellationToken)
    {
        var form = await context.KurdnezamForms
            .AsNoTracking()
            .FirstOrDefaultAsync(f => f.Id == request.FormId, cancellationToken);

        Guard.Against.NotFound(request.FormId, form);

        if (!form.IsOpen)
        {
            var ex = new ValidationException();
            ex.Errors["Form"] = new[] { "این فرم بسته شده است." };
            throw ex;
        }

        var i = request.Input;

        var entity = new KurdnezamFormSubmission
        {
            FormId = form.Id,
            FullName = i.FullName,
            NationalId = i.NationalId,
            MembershipNo = i.MembershipNo,
            Mobile = i.Mobile,
            Notes = i.Notes,
            IsHandled = false
        };

        context.KurdnezamFormSubmissions.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

public class SubmitKurdnezamFormCommandValidator : AbstractValidator<SubmitKurdnezamFormCommand>
{
    public SubmitKurdnezamFormCommandValidator()
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamFormSubmissionInputValidator());
    }
}

// ── handle / delete a submission (admin) ─────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record SetKurdnezamFormSubmissionHandledCommand(int SubmissionId, bool IsHandled) : IRequest;

public class SetKurdnezamFormSubmissionHandledCommandHandler(IApplicationDbContext context)
    : IRequestHandler<SetKurdnezamFormSubmissionHandledCommand>
{
    public async Task Handle(SetKurdnezamFormSubmissionHandledCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamFormSubmissions
            .FirstOrDefaultAsync(s => s.Id == request.SubmissionId, cancellationToken);

        Guard.Against.NotFound(request.SubmissionId, entity);

        entity.IsHandled = request.IsHandled;

        await context.SaveChangesAsync(cancellationToken);
    }
}

[Authorize(Roles = Roles.Administrator)]
public record DeleteKurdnezamFormSubmissionCommand(int SubmissionId) : IRequest;

public class DeleteKurdnezamFormSubmissionCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteKurdnezamFormSubmissionCommand>
{
    public async Task Handle(DeleteKurdnezamFormSubmissionCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamFormSubmissions
            .FirstOrDefaultAsync(s => s.Id == request.SubmissionId, cancellationToken);

        Guard.Against.NotFound(request.SubmissionId, entity);

        context.KurdnezamFormSubmissions.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── shared input validation ──────────────────────────────────────────────────

public class KurdnezamFormInputValidator : AbstractValidator<KurdnezamFormInput>
{
    public KurdnezamFormInputValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Note).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.Deadline).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Image).NotEmpty().MaximumLength(1000);
    }
}

public class KurdnezamFormSubmissionInputValidator : AbstractValidator<KurdnezamFormSubmissionInput>
{
    public KurdnezamFormSubmissionInputValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.NationalId).NotEmpty().MaximumLength(20);
        RuleFor(x => x.MembershipNo).NotEmpty().MaximumLength(50);
        RuleFor(x => x.Mobile).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Notes).MaximumLength(2000);
    }
}
