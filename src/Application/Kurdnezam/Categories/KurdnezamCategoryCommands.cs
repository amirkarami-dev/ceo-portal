using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Kurdnezam;
using Microsoft.EntityFrameworkCore;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Kurdnezam.Categories;

/// <summary>Fields an administrator may set on a category. Shared by create and update.</summary>
public sealed record KurdnezamCategoryInput(
    string Title,
    int SortOrder);

// ── create ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record CreateKurdnezamCategoryCommand(KurdnezamCategoryInput Input) : IRequest<int>;

public class CreateKurdnezamCategoryCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateKurdnezamCategoryCommand, int>
{
    public async Task<int> Handle(CreateKurdnezamCategoryCommand request, CancellationToken cancellationToken)
    {
        var i = request.Input;

        var entity = new KurdnezamCategory
        {
            Title = i.Title,
            SortOrder = i.SortOrder
        };

        context.KurdnezamCategories.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

public class CreateKurdnezamCategoryCommandValidator : AbstractValidator<CreateKurdnezamCategoryCommand>
{
    public CreateKurdnezamCategoryCommandValidator()
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamCategoryInputValidator());
    }
}

// ── update ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record UpdateKurdnezamCategoryCommand(int Id, KurdnezamCategoryInput Input) : IRequest;

public class UpdateKurdnezamCategoryCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateKurdnezamCategoryCommand>
{
    public async Task Handle(UpdateKurdnezamCategoryCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamCategories
            .FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        var i = request.Input;

        entity.Title = i.Title;
        entity.SortOrder = i.SortOrder;

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateKurdnezamCategoryCommandValidator : AbstractValidator<UpdateKurdnezamCategoryCommand>
{
    public UpdateKurdnezamCategoryCommandValidator()
    {
        RuleFor(x => x.Input).SetValidator(new KurdnezamCategoryInputValidator());
    }
}

// ── delete ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record DeleteKurdnezamCategoryCommand(int Id) : IRequest;

public class DeleteKurdnezamCategoryCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteKurdnezamCategoryCommand>
{
    public async Task Handle(DeleteKurdnezamCategoryCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.KurdnezamCategories
            .FirstOrDefaultAsync(c => c.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        // The news FK is DeleteBehavior.Restrict, so a category still in use would surface as a raw
        // DB error. Turn it into a 400 the admin panel can render on the field.
        var inUse = await context.KurdnezamNews
            .AnyAsync(n => n.CategoryId == request.Id, cancellationToken);

        if (inUse)
        {
            var ex = new ValidationException();
            ex.Errors["CategoryId"] = new[]
            {
                "This category still has news articles. Move or delete them before deleting the category."
            };
            throw ex;
        }

        context.KurdnezamCategories.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── shared input validation ──────────────────────────────────────────────────

public class KurdnezamCategoryInputValidator : AbstractValidator<KurdnezamCategoryInput>
{
    public KurdnezamCategoryInputValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
    }
}
