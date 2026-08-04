using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Kurdnezam;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.OrgPages;

/// <summary>Fields an administrator may set on an org page. Shared by create and update.</summary>
/// <remarks>
/// The last four are optional with defaults, so every existing caller of this record — and every
/// stored admin payload — keeps working unchanged.
/// </remarks>
public sealed record KurdnezamOrgPageInput(
    string Slug,
    string Title,
    string Intro,
    int SortOrder,
    string? Group = null,
    string? ParentSlug = null,
    string? Icon = null,
    string Summary = "");

// ── create ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record CreateKurdnezamOrgPageCommand(KurdnezamOrgPageInput Input) : IRequest<int>;

public class CreateKurdnezamOrgPageCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateKurdnezamOrgPageCommand, int>
{
    public async Task<int> Handle(CreateKurdnezamOrgPageCommand request, CancellationToken cancellationToken)
    {
        var i = request.Input;

        var entity = new KurdnezamOrgPage
        {
            Slug = i.Slug,
            Title = i.Title,
            Group = i.Group,
            Intro = i.Intro,
            ParentSlug = i.ParentSlug,
            Icon = i.Icon,
            Summary = i.Summary,
            SortOrder = i.SortOrder
        };

        context.KurdnezamOrgPages.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

public class CreateKurdnezamOrgPageCommandValidator : AbstractValidator<CreateKurdnezamOrgPageCommand>
{
    public CreateKurdnezamOrgPageCommandValidator(IApplicationDbContext context)
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamOrgPageInputValidator());

        RuleFor(x => x.Input.Slug)
            .MustAsync(async (slug, ct) => !await context.KurdnezamOrgPages.AnyAsync(p => p.Slug == slug, ct))
            .WithMessage("An org page with this slug already exists.");

        RuleFor(x => x.Input.ParentSlug)
            .MustAsync((parent, ct) => KurdnezamOrgPageParentRules.ParentExistsAsync(context, parent, ct))
            .WithMessage("No org page has that parent slug.")
            .MustAsync((parent, ct) => KurdnezamOrgPageParentRules.ParentIsTopLevelAsync(context, parent, ct))
            .WithMessage("The parent page is itself a child; only one level is supported.");
    }
}

// ── update ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record UpdateKurdnezamOrgPageCommand(int Id, KurdnezamOrgPageInput Input) : IRequest;

public class UpdateKurdnezamOrgPageCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateKurdnezamOrgPageCommand>
{
    public async Task Handle(UpdateKurdnezamOrgPageCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamOrgPages
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        var i = request.Input;

        entity.Slug = i.Slug;
        entity.Title = i.Title;
        entity.Group = i.Group;
        entity.Intro = i.Intro;
        entity.ParentSlug = i.ParentSlug;
        entity.Icon = i.Icon;
        entity.Summary = i.Summary;
        entity.SortOrder = i.SortOrder;

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateKurdnezamOrgPageCommandValidator : AbstractValidator<UpdateKurdnezamOrgPageCommand>
{
    public UpdateKurdnezamOrgPageCommandValidator(IApplicationDbContext context)
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamOrgPageInputValidator());

        // Uniqueness must ignore the row being edited, so it lives here rather than in the shared input validator.
        RuleFor(x => x.Input.Slug)
            .MustAsync(async (command, slug, ct) =>
                !await context.KurdnezamOrgPages.AnyAsync(p => p.Slug == slug && p.Id != command.Id, ct))
            .WithMessage("An org page with this slug already exists.");

        RuleFor(x => x.Input.ParentSlug)
            .MustAsync((parent, ct) => KurdnezamOrgPageParentRules.ParentExistsAsync(context, parent, ct))
            .WithMessage("No org page has that parent slug.")
            .MustAsync((parent, ct) => KurdnezamOrgPageParentRules.ParentIsTopLevelAsync(context, parent, ct))
            .WithMessage("The parent page is itself a child; only one level is supported.");

        // Children point at their parent by SLUG, and nothing cascades a rename. Changing the slug
        // of a page that has children would leave every one of them pointing at a slug that no
        // longer exists: their cards and menu entries vanish and the pages become reachable only by
        // typing the URL. Refused rather than cascaded, because a slug is a public URL and silently
        // rewriting six of them is worse than saying no.
        RuleFor(x => x.Input.Slug)
            .MustAsync(async (command, slug, ct) =>
            {
                var current = await context.KurdnezamOrgPages
                    .AsNoTracking()
                    .Where(p => p.Id == command.Id)
                    .Select(p => p.Slug)
                    .FirstOrDefaultAsync(ct);

                if (current is null || current == slug) return true;

                return !await context.KurdnezamOrgPages.AnyAsync(p => p.ParentSlug == current, ct);
            })
            .WithMessage("This page has children that refer to its current slug, so the slug cannot be changed. Move them to another parent first.");

        // Demoting a hub that still has children would orphan them: their cards and dropdown entries
        // would vanish while the pages stayed reachable only by typing the URL.
        RuleFor(x => x.Input)
            .MustAsync(async (command, input, ct) =>
                string.IsNullOrEmpty(input.ParentSlug)
                || !await context.KurdnezamOrgPages.AnyAsync(p => p.ParentSlug == input.Slug, ct))
            .WithMessage("This page has children of its own, so it cannot be moved under another page.")
            .OverridePropertyName(nameof(KurdnezamOrgPageInput.ParentSlug));
    }
}

// ── delete ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record DeleteKurdnezamOrgPageCommand(int Id) : IRequest;

public class DeleteKurdnezamOrgPageCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteKurdnezamOrgPageCommand>
{
    public async Task Handle(DeleteKurdnezamOrgPageCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamOrgPages
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        context.KurdnezamOrgPages.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── shared input validation ──────────────────────────────────────────────────

public class KurdnezamOrgPageInputValidator : AbstractValidator<KurdnezamOrgPageInput>
{
    public KurdnezamOrgPageInputValidator()
    {
        RuleFor(x => x.Slug).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Intro).NotEmpty();

        RuleFor(x => x.Group)
            .MaximumLength(50)
            .Must(g => g is null || KurdnezamPersonGroups.IsValid(g))
            .WithMessage("The selected group is not a valid person group.");

        RuleFor(x => x.ParentSlug).MaximumLength(100);
        RuleFor(x => x.Summary).MaximumLength(500);

        RuleFor(x => x.Icon)
            .MaximumLength(50)
            .Must(icon => string.IsNullOrEmpty(icon) || KurdnezamContactIcons.IsValid(icon))
            .WithMessage("The selected icon is not one the site can draw.");

        // A page under itself would render a card linking to the page you are already on, and the
        // nav dropdown would list its own parent.
        RuleFor(x => x.ParentSlug)
            .Must((input, parent) => string.IsNullOrEmpty(parent) || parent != input.Slug)
            .WithMessage("A page cannot be its own parent.");
    }
}

/// <summary>
/// The parent must exist and must itself be top level. The site draws exactly one level of cards
/// and one level of dropdown, so a grandchild would never appear anywhere — better to refuse it
/// than to accept a page nobody can reach.
/// </summary>
internal static class KurdnezamOrgPageParentRules
{
    public static async Task<bool> ParentExistsAsync(
        IApplicationDbContext context, string? parentSlug, CancellationToken ct)
        => string.IsNullOrEmpty(parentSlug)
           || await context.KurdnezamOrgPages.AnyAsync(p => p.Slug == parentSlug, ct);

    public static async Task<bool> ParentIsTopLevelAsync(
        IApplicationDbContext context, string? parentSlug, CancellationToken ct)
        => string.IsNullOrEmpty(parentSlug)
           || await context.KurdnezamOrgPages.AnyAsync(p => p.Slug == parentSlug && p.ParentSlug == null, ct);
}
