using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Kurdnezam;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Kurdnezam.Forms;

/// <summary>One field an administrator defined. <c>Id 0</c> means a new one.</summary>
public sealed record KurdnezamFormFieldInput(
    int Id,
    string Label,
    string Kind,
    bool IsRequired = false,
    bool AllowMultiple = false,
    int? MaxLength = null,
    string? Help = null,
    int SortOrder = 0);

/// <summary>Fields an administrator may set on a form. Shared by create and update.</summary>
public sealed record KurdnezamFormInput(
    string Title,
    string Note,
    string Deadline,
    string Image,
    bool IsOpen = true,
    string SuccessMessage = "",
    int SortOrder = 0,
    IReadOnlyList<KurdnezamFormFieldInput>? Fields = null);

/// <summary>One answer a member typed. Files arrive separately, as <see cref="IKurdnezamFormUpload"/>.</summary>
public sealed record KurdnezamFormAnswerInput(int FieldId, string Text);

// ── create form ──────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
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
            SuccessMessage = i.SuccessMessage,
            SortOrder = i.SortOrder
        };

        foreach (var f in i.Fields ?? [])
            entity.Fields.Add(ToField(f));

        context.KurdnezamForms.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }

    internal static KurdnezamFormField ToField(KurdnezamFormFieldInput f) => new()
    {
        Label = f.Label,
        Kind = f.Kind,
        IsRequired = f.IsRequired,
        AllowMultiple = f.Kind == KurdnezamFormFieldKinds.File && f.AllowMultiple,
        MaxLength = f.Kind == KurdnezamFormFieldKinds.Text ? f.MaxLength : null,
        Help = f.Help,
        SortOrder = f.SortOrder
    };
}

public class CreateKurdnezamFormCommandValidator : AbstractValidator<CreateKurdnezamFormCommand>
{
    public CreateKurdnezamFormCommandValidator()
        => RuleFor(x => x.Input).SetValidator(new KurdnezamFormInputValidator());
}

// ── update form ──────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record UpdateKurdnezamFormCommand(int Id, KurdnezamFormInput Input) : IRequest;

public class UpdateKurdnezamFormCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateKurdnezamFormCommand>
{
    public async Task Handle(UpdateKurdnezamFormCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamForms
            .Include(f => f.Fields)
            .FirstOrDefaultAsync(f => f.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        var i = request.Input;

        entity.Title = i.Title;
        entity.Note = i.Note;
        entity.Deadline = i.Deadline;
        entity.Image = i.Image;
        entity.IsOpen = i.IsOpen;
        entity.SuccessMessage = i.SuccessMessage;
        entity.SortOrder = i.SortOrder;

        // Match by Id rather than replacing the lot. Answers record the field id they were sent
        // against, so keeping ids stable keeps old submissions grouped under the right field.
        var wanted = i.Fields ?? [];
        var byId = wanted.Where(f => f.Id != 0).ToDictionary(f => f.Id);

        foreach (var existing in entity.Fields.ToList())
        {
            if (byId.TryGetValue(existing.Id, out var f))
            {
                existing.Label = f.Label;
                existing.Kind = f.Kind;
                existing.IsRequired = f.IsRequired;
                existing.AllowMultiple = f.Kind == KurdnezamFormFieldKinds.File && f.AllowMultiple;
                existing.MaxLength = f.Kind == KurdnezamFormFieldKinds.Text ? f.MaxLength : null;
                existing.Help = f.Help;
                existing.SortOrder = f.SortOrder;
            }
            else
            {
                // Answers already sent for this field are NOT deleted — they are not linked by a
                // foreign key and carry their own copy of the label. See KurdnezamFormAnswer.
                entity.Fields.Remove(existing);
            }
        }

        foreach (var f in wanted.Where(f => f.Id == 0))
            entity.Fields.Add(CreateKurdnezamFormCommandHandler.ToField(f));

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateKurdnezamFormCommandValidator : AbstractValidator<UpdateKurdnezamFormCommand>
{
    public UpdateKurdnezamFormCommandValidator()
        => RuleFor(x => x.Input).SetValidator(new KurdnezamFormInputValidator());
}

// ── delete form ──────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record DeleteKurdnezamFormCommand(int Id) : IRequest;

public class DeleteKurdnezamFormCommandHandler(IApplicationDbContext context, IFileStorage storage, ILogger<DeleteKurdnezamFormCommandHandler> logger)
    : IRequestHandler<DeleteKurdnezamFormCommand>
{
    public async Task Handle(DeleteKurdnezamFormCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamForms
            .FirstOrDefaultAsync(f => f.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        // The rows cascade, but the objects in storage do not — collect their keys first or the
        // bucket keeps every file this form ever received.
        var keys = await context.KurdnezamFormAttachments
            .Where(a => a.Submission!.FormId == entity.Id)
            .Select(a => a.StoredKey)
            .ToListAsync(cancellationToken);

        context.KurdnezamForms.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);

        await DeleteObjectsAsync(storage, keys, logger, cancellationToken);
    }

    /// <summary>
    /// Best effort. The rows are already gone, so a storage failure must not throw — that would
    /// report a failed delete for work that actually succeeded. A left-behind object is logged.
    /// </summary>
    internal static async Task DeleteObjectsAsync(
        IFileStorage storage, IEnumerable<string> keys, ILogger logger, CancellationToken ct)
    {
        foreach (var key in keys)
        {
            try
            {
                await storage.DeleteAsync(key, ct);
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Kurdnezam form attachment {Key} was not removed from storage", key);
            }
        }
    }
}

// ── submit a form (public) ───────────────────────────────────────────────────

/// <summary>
/// A member sending a form. Deliberately NOT gated: the landing site posts this with no account.
/// Files arrive with it, so nothing is written to storage until the whole thing passes.
/// </summary>
public record SubmitKurdnezamFormCommand(
    int FormId,
    IReadOnlyList<KurdnezamFormAnswerInput> Answers,
    IReadOnlyList<IKurdnezamFormUpload> Files) : IRequest<int>;

public class SubmitKurdnezamFormCommandHandler(
    IApplicationDbContext context,
    IFileStorage storage,
    ILogger<SubmitKurdnezamFormCommandHandler> logger)
    : IRequestHandler<SubmitKurdnezamFormCommand, int>
{
    public async Task<int> Handle(SubmitKurdnezamFormCommand request, CancellationToken cancellationToken)
    {
        var form = await context.KurdnezamForms
            .AsNoTracking()
            .Include(f => f.Fields)
            .FirstOrDefaultAsync(f => f.Id == request.FormId, cancellationToken);

        Guard.Against.NotFound(request.FormId, form);

        var errors = Validate(form, request.Answers, request.Files);
        if (errors.Count > 0)
        {
            var ex = new ValidationException();
            foreach (var (key, message) in errors) ex.Errors[key] = [message];
            throw ex;
        }

        var byId = form.Fields.ToDictionary(f => f.Id);

        var submission = new KurdnezamFormSubmission { FormId = form.Id, IsHandled = false };

        foreach (var a in request.Answers)
        {
            if (!byId.TryGetValue(a.FieldId, out var field) || field.Kind != KurdnezamFormFieldKinds.Text) continue;

            submission.Answers.Add(new KurdnezamFormAnswer
            {
                FieldId = field.Id,
                FieldLabel = field.Label,
                Text = a.Text.Trim()
            });
        }

        // Upload only after every check has passed, and remember the keys: if the save then fails
        // these objects are the only thing left behind, so they are removed again.
        var written = new List<string>();
        try
        {
            foreach (var file in request.Files)
            {
                var field = byId[file.FieldId];
                var extension = KurdnezamFormUploadLimits.AllowedTypes[file.ContentType];
                var key = $"{KurdnezamFormUploadLimits.StoragePrefix}{Guid.NewGuid():N}{extension}";

                await using (var stream = file.OpenRead())
                {
                    await storage.PutAsync(key, stream, file.ContentType, cancellationToken);
                }
                written.Add(key);

                submission.Attachments.Add(new KurdnezamFormAttachment
                {
                    FieldId = field.Id,
                    FieldLabel = field.Label,
                    FileName = file.FileName,
                    StoredKey = key,
                    ContentType = file.ContentType,
                    SizeBytes = file.SizeBytes
                });
            }

            context.KurdnezamFormSubmissions.Add(submission);
            await context.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            await DeleteKurdnezamFormCommandHandler.DeleteObjectsAsync(storage, written, logger, CancellationToken.None);
            throw;
        }

        return submission.Id;
    }

    /// <summary>
    /// Every rule the public form must obey, checked against the form's own fields. Returns
    /// (key, message) pairs so the site can put each message under the right input.
    /// </summary>
    internal static List<(string Key, string Message)> Validate(
        KurdnezamForm form,
        IReadOnlyList<KurdnezamFormAnswerInput> answers,
        IReadOnlyList<IKurdnezamFormUpload> files)
    {
        var errors = new List<(string, string)>();

        if (!form.IsOpen)
        {
            errors.Add(("Form", "این فرم بسته شده است."));
            return errors;
        }

        var byId = form.Fields.ToDictionary(f => f.Id);
        var textById = answers.GroupBy(a => a.FieldId).ToDictionary(g => g.Key, g => g.Last().Text ?? string.Empty);
        var filesById = files.GroupBy(f => f.FieldId).ToDictionary(g => g.Key, g => g.ToList());

        // Anything aimed at a field this form does not have is refused rather than dropped, so a
        // stale page cannot silently lose what someone typed.
        foreach (var id in textById.Keys.Concat(filesById.Keys).Distinct().Where(id => !byId.ContainsKey(id)))
            errors.Add(($"field_{id}", "این فیلد در فرم وجود ندارد."));

        foreach (var field in form.Fields)
        {
            var key = $"field_{field.Id}";

            if (field.Kind == KurdnezamFormFieldKinds.Text)
            {
                var text = textById.GetValueOrDefault(field.Id, string.Empty).Trim();

                if (field.IsRequired && text.Length == 0)
                    errors.Add((key, "این فیلد الزامی است."));

                if (field.MaxLength is { } max && text.Length > max)
                    errors.Add((key, $"حداکثر {max} نویسه."));

                if (filesById.ContainsKey(field.Id))
                    errors.Add((key, "این فیلد فایل نمی‌پذیرد."));

                continue;
            }

            var attached = filesById.GetValueOrDefault(field.Id, []);

            if (field.IsRequired && attached.Count == 0)
                errors.Add((key, "بارگذاری فایل الزامی است."));

            if (!field.AllowMultiple && attached.Count > 1)
                errors.Add((key, "فقط یک فایل مجاز است."));

            if (attached.Count > KurdnezamFormUploadLimits.MaxFilesPerField)
                errors.Add((key, $"حداکثر {KurdnezamFormUploadLimits.MaxFilesPerField} فایل."));

            foreach (var file in attached)
            {
                if (file.SizeBytes <= 0)
                    errors.Add((key, $"فایل «{file.FileName}» خالی است."));
                else if (file.SizeBytes > KurdnezamFormUploadLimits.MaxBytesPerFile)
                    errors.Add((key, $"فایل «{file.FileName}» بزرگ‌تر از حد مجاز است ({KurdnezamFormUploadLimits.Describe()})."));

                if (!KurdnezamFormUploadLimits.AllowedTypes.ContainsKey(file.ContentType ?? string.Empty))
                    errors.Add((key, $"نوع فایل «{file.FileName}» مجاز نیست ({KurdnezamFormUploadLimits.Describe()})."));
            }
        }

        var total = files.Sum(f => f.SizeBytes);
        if (total > KurdnezamFormUploadLimits.MaxBytesPerSubmission)
        {
            errors.Add(("Form",
                $"مجموع فایل‌ها بیش از {KurdnezamFormUploadLimits.MaxBytesPerSubmission / (1024 * 1024)} مگابایت است."));
        }

        return errors;
    }
}

// ── handle / delete a submission (admin) ─────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
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

[Authorize(Roles = Roles.AdminOrSuper)]
public record DeleteKurdnezamFormSubmissionCommand(int SubmissionId) : IRequest;

public class DeleteKurdnezamFormSubmissionCommandHandler(
    IApplicationDbContext context,
    IFileStorage storage,
    ILogger<DeleteKurdnezamFormSubmissionCommandHandler> logger)
    : IRequestHandler<DeleteKurdnezamFormSubmissionCommand>
{
    public async Task Handle(DeleteKurdnezamFormSubmissionCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamFormSubmissions
            .Include(s => s.Attachments)
            .FirstOrDefaultAsync(s => s.Id == request.SubmissionId, cancellationToken);

        Guard.Against.NotFound(request.SubmissionId, entity);

        var keys = entity.Attachments.Select(a => a.StoredKey).ToList();

        context.KurdnezamFormSubmissions.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);

        await DeleteKurdnezamFormCommandHandler.DeleteObjectsAsync(storage, keys, logger, cancellationToken);
    }
}

// ── shared input validation ──────────────────────────────────────────────────

public class KurdnezamFormFieldInputValidator : AbstractValidator<KurdnezamFormFieldInput>
{
    public KurdnezamFormFieldInputValidator()
    {
        RuleFor(x => x.Label).NotEmpty().MaximumLength(300);

        RuleFor(x => x.Kind)
            .NotEmpty()
            .Must(KurdnezamFormFieldKinds.IsValid)
            .WithMessage($"Kind must be one of: {string.Join(", ", KurdnezamFormFieldKinds.All)}.");

        RuleFor(x => x.Help).MaximumLength(500);

        RuleFor(x => x.MaxLength)
            .InclusiveBetween(1, 4000)
            .When(x => x.MaxLength.HasValue)
            .WithMessage("MaxLength must be between 1 and 4000.");
    }
}

public class KurdnezamFormInputValidator : AbstractValidator<KurdnezamFormInput>
{
    public KurdnezamFormInputValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Note).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.Deadline).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Image).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.SuccessMessage).MaximumLength(1000);

        RuleForEach(x => x.Fields).SetValidator(new KurdnezamFormFieldInputValidator());

        // A form with no fields would render as a lone save button.
        RuleFor(x => x.Fields)
            .Must(f => f is { Count: > 0 })
            .WithMessage("A form needs at least one field.");
    }
}
