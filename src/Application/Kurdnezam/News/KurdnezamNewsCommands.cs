using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Kurdnezam;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.News;

/// <summary>Fields an administrator may set on an article. Shared by create and update.</summary>
/// <remarks>
/// <paramref name="Attachments"/> is the COMPLETE list: update replaces the article's files with
/// exactly what is sent, so removing one client-side removes it here too. Order follows the array.
/// </remarks>
public sealed record KurdnezamNewsInput(
    string Title,
    string Summary,
    string Body,
    string Date,
    string Author,
    int CategoryId,
    string Image,
    bool Featured,
    int? UnitId = null,
    DateTimeOffset? PublishedAt = null,
    IReadOnlyList<KurdnezamNewsAttachmentInput>? Attachments = null);

/// <summary>One file to attach. The bytes are already in storage via /api/kurdnezam/media.</summary>
public sealed record KurdnezamNewsAttachmentInput(
    string Url,
    string FileName,
    string ContentType,
    long SizeBytes);

// ── create ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record CreateKurdnezamNewsCommand(KurdnezamNewsInput Input) : IRequest<int>;

public class CreateKurdnezamNewsCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateKurdnezamNewsCommand, int>
{
    public async Task<int> Handle(CreateKurdnezamNewsCommand request, CancellationToken cancellationToken)
    {
        var i = request.Input;

        var entity = new KurdnezamNews
        {
            Title = i.Title,
            Summary = i.Summary,
            Body = i.Body,
            DateJalali = i.Date,
            PublishedAt = i.PublishedAt ?? DateTimeOffset.UtcNow,
            Author = i.Author,
            CategoryId = i.CategoryId,
            UnitId = i.UnitId,
            Image = i.Image,
            Featured = i.Featured
        };

        foreach (var attachment in KurdnezamNewsAttachments.Map(i.Attachments))
            entity.Attachments.Add(attachment);

        context.KurdnezamNews.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

public class CreateKurdnezamNewsCommandValidator : AbstractValidator<CreateKurdnezamNewsCommand>
{
    public CreateKurdnezamNewsCommandValidator(IApplicationDbContext context)
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamNewsInputValidator(context));
    }
}

// ── update ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record UpdateKurdnezamNewsCommand(int Id, KurdnezamNewsInput Input) : IRequest;

public class UpdateKurdnezamNewsCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateKurdnezamNewsCommand>
{
    public async Task Handle(UpdateKurdnezamNewsCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamNews
            .Include(n => n.Attachments)
            .FirstOrDefaultAsync(n => n.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        var i = request.Input;

        entity.Title = i.Title;
        entity.Summary = i.Summary;
        entity.Body = i.Body;
        entity.DateJalali = i.Date;
        entity.Author = i.Author;
        entity.CategoryId = i.CategoryId;
        entity.UnitId = i.UnitId;
        entity.Image = i.Image;
        entity.Featured = i.Featured;

        if (i.PublishedAt is { } publishedAt)
            entity.PublishedAt = publishedAt;

        // The input carries the COMPLETE list, so clearing and re-adding is what "removed in the
        // panel" means. The FK is required + cascade, so the cleared rows are deleted, not orphaned.
        entity.Attachments.Clear();
        foreach (var attachment in KurdnezamNewsAttachments.Map(i.Attachments))
            entity.Attachments.Add(attachment);

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateKurdnezamNewsCommandValidator : AbstractValidator<UpdateKurdnezamNewsCommand>
{
    public UpdateKurdnezamNewsCommandValidator(IApplicationDbContext context)
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamNewsInputValidator(context));
    }
}

// ── delete ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record DeleteKurdnezamNewsCommand(int Id) : IRequest;

public class DeleteKurdnezamNewsCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteKurdnezamNewsCommand>
{
    public async Task Handle(DeleteKurdnezamNewsCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamNews
            .FirstOrDefaultAsync(n => n.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        context.KurdnezamNews.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── shared attachment mapping ────────────────────────────────────────────────

/// <summary>Turns the request's file list into entities, numbering them by array position.</summary>
internal static class KurdnezamNewsAttachments
{
    public static IEnumerable<KurdnezamNewsAttachment> Map(
        IReadOnlyList<KurdnezamNewsAttachmentInput>? input) =>
        (input ?? []).Select((a, index) => new KurdnezamNewsAttachment
        {
            Url = a.Url.Trim(),
            FileName = a.FileName.Trim(),
            ContentType = a.ContentType.Trim(),
            SizeBytes = a.SizeBytes,
            SortOrder = index
        });
}

// ── shared input validation ──────────────────────────────────────────────────

public class KurdnezamNewsInputValidator : AbstractValidator<KurdnezamNewsInput>
{
    public KurdnezamNewsInputValidator(IApplicationDbContext context)
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Summary).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.Body).NotEmpty();
        RuleFor(x => x.Date).NotEmpty().MaximumLength(30);
        RuleFor(x => x.Author).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Image).NotEmpty().MaximumLength(1000);

        RuleFor(x => x.CategoryId)
            .MustAsync(async (id, ct) => await context.KurdnezamCategories.AnyAsync(c => c.Id == id, ct))
            .WithMessage("The selected category does not exist.");

        RuleFor(x => x.UnitId)
            .MustAsync(async (id, ct) => id is null || await context.KurdnezamUnits.AnyAsync(u => u.Id == id, ct))
            .WithMessage("The selected unit does not exist.");

        RuleForEach(x => x.Attachments).ChildRules(a =>
        {
            a.RuleFor(x => x.Url).NotEmpty().MaximumLength(1000);
            a.RuleFor(x => x.FileName).NotEmpty().MaximumLength(300);
            a.RuleFor(x => x.ContentType).NotEmpty().MaximumLength(150);
            a.RuleFor(x => x.SizeBytes).GreaterThan(0);
        });
    }
}
