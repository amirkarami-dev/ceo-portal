using Ardalis.GuardClauses;
using FluentValidation;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Walfare;
using Microsoft.EntityFrameworkCore;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Walfare.Guesthouses;

file static class Fail
{
    public static ValidationException With(string property, string message) =>
        new([new FluentValidation.Results.ValidationFailure(property, message)]);
}

/// <summary>
/// A guesthouse may only hang off a service of type <see cref="WelfareServiceType.Guesthouse"/>.
/// </summary>
/// <remarks>
/// The member's services page routes by <c>WelfareService.Type</c>: a guesthouse attached to a pool
/// service is simply unreachable — the member is sent to the booking calendar and never sees it, and
/// nothing anywhere reports a problem. The admin picker filters the list, but a picker is a
/// convenience, not a rule; this is the rule.
///
/// The null case earns its place too. A ServiceId that matches nothing used to reach the database
/// and come back as a foreign-key violation: a 500 with no field message, where the admin deserved
/// one sentence next to the box they got wrong.
/// </remarks>
public static class GuesthouseServiceRule
{
    /// <summary>The Persian reason this service cannot hold a guesthouse, or null when it can.</summary>
    /// <param name="serviceType">The service's type, or <c>null</c> when no such service exists.</param>
    public static string? Reject(WelfareServiceType? serviceType) => serviceType switch
    {
        null => "خدمت انتخاب‌شده یافت نشد.",
        WelfareServiceType.Guesthouse => null,
        _ => "مهمانسرا فقط زیر خدمتی از نوع «مهمانسرا» تعریف می‌شود."
    };

    /// <summary>Looks the service up and throws a field-level 400 when it may not hold a guesthouse.</summary>
    public static async Task EnsureCanHoldGuesthouseAsync(
        IApplicationDbContext context, int serviceId, CancellationToken cancellationToken)
    {
        var type = await context.WelfareServices
            .Where(s => s.Id == serviceId)
            .Select(s => (WelfareServiceType?)s.Type)
            .FirstOrDefaultAsync(cancellationToken);

        if (Reject(type) is { } reason) throw Fail.With("ServiceId", reason);
    }
}

public sealed record GuesthouseDto
{
    public int Id { get; init; }
    public int ServiceId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string City { get; init; } = string.Empty;
    public string ManagerName { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public bool IsActive { get; init; }
}

public sealed record GuesthouseInput(
    int ServiceId,
    string Name,
    string City,
    string ManagerName,
    string Description,
    bool IsActive);

public class GuesthouseInputValidator : AbstractValidator<GuesthouseInput>
{
    public GuesthouseInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("نام مهمانسرا الزامی است.").MaximumLength(200);
        RuleFor(x => x.City).NotEmpty().WithMessage("شهرستان الزامی است.").MaximumLength(100);
        RuleFor(x => x.ManagerName).MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(1000);
    }
}

/// <summary>
/// Bridges the input validator onto the command.
/// </summary>
/// <remarks>
/// Without this the rules above are DEAD CODE: ValidationBehaviour resolves
/// IValidator&lt;TRequest&gt; where TRequest is the command, so an AbstractValidator&lt;GuesthouseInput&gt;
/// is never found and never runs. WelfarePools.cs bridges the same way.
/// </remarks>
public class CreateGuesthouseCommandValidator : AbstractValidator<CreateGuesthouseCommand>
{
    public CreateGuesthouseCommandValidator()
        => RuleFor(x => x.Input).SetValidator(new GuesthouseInputValidator());
}

public class UpdateGuesthouseCommandValidator : AbstractValidator<UpdateGuesthouseCommand>
{
    public UpdateGuesthouseCommandValidator()
        => RuleFor(x => x.Input).SetValidator(new GuesthouseInputValidator());
}

/// <summary>Shared projection so the member list and the admin list cannot drift apart.</summary>
internal static class GuesthouseDtoProjection
{
    public static GuesthouseDto From(WelfareGuesthouse g) => new()
    {
        Id = g.Id,
        ServiceId = g.ServiceId,
        Name = g.Name,
        City = g.City,
        ManagerName = g.ManagerName,
        Description = g.Description,
        IsActive = g.IsActive
    };

    /// <summary>
    /// The member-visible shape. Same fields as <see cref="From"/> except <see cref="GuesthouseDto.ManagerName"/>:
    /// that is the guesthouse manager's name, meant only for the printed referral letter, and has no
    /// member-facing purpose.
    /// </summary>
    public static GuesthouseDto ForMember(WelfareGuesthouse g) => From(g) with { ManagerName = string.Empty };
}

// ── member: the guesthouses they may ask for ────────────────────────────────

[Authorize]
public record GetActiveGuesthousesQuery(int ServiceId) : IRequest<IReadOnlyList<GuesthouseDto>>;

public class GetActiveGuesthousesQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetActiveGuesthousesQuery, IReadOnlyList<GuesthouseDto>>
{
    public async Task<IReadOnlyList<GuesthouseDto>> Handle(
        GetActiveGuesthousesQuery request, CancellationToken cancellationToken)
    {
        var rows = await context.WelfareGuesthouses
            .AsNoTracking()
            // The parent service's on/off switch must be honoured here too, exactly as WelfarePool
            // does: switching a service off must pull its guesthouses out of the member list, not
            // just IsActive on the guesthouse row itself.
            .Where(g => g.ServiceId == request.ServiceId && g.IsActive
                        && g.Service!.IsAccessible)
            .OrderBy(g => g.City).ThenBy(g => g.Name)
            .ToListAsync(cancellationToken);

        return rows.Select(GuesthouseDtoProjection.ForMember).ToList();
    }
}

// ── admin CRUD ──────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record GetGuesthousesAdminQuery : IRequest<IReadOnlyList<GuesthouseDto>>;

public class GetGuesthousesAdminQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetGuesthousesAdminQuery, IReadOnlyList<GuesthouseDto>>
{
    public async Task<IReadOnlyList<GuesthouseDto>> Handle(
        GetGuesthousesAdminQuery request, CancellationToken cancellationToken)
    {
        var rows = await context.WelfareGuesthouses
            .AsNoTracking()
            .OrderBy(g => g.City).ThenBy(g => g.Name)
            .ToListAsync(cancellationToken);

        return rows.Select(GuesthouseDtoProjection.From).ToList();
    }
}

[Authorize(Roles = Roles.AdminOrSuper)]
public record CreateGuesthouseCommand(GuesthouseInput Input) : IRequest<int>;

public class CreateGuesthouseCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateGuesthouseCommand, int>
{
    public async Task<int> Handle(CreateGuesthouseCommand request, CancellationToken cancellationToken)
    {
        await GuesthouseServiceRule.EnsureCanHoldGuesthouseAsync(
            context, request.Input.ServiceId, cancellationToken);

        var entity = new WelfareGuesthouse
        {
            ServiceId = request.Input.ServiceId,
            Name = request.Input.Name.Trim(),
            City = request.Input.City.Trim(),
            ManagerName = request.Input.ManagerName.Trim(),
            Description = request.Input.Description.Trim(),
            IsActive = request.Input.IsActive
        };

        context.WelfareGuesthouses.Add(entity);
        await context.SaveChangesAsync(cancellationToken);
        return entity.Id;
    }
}

[Authorize(Roles = Roles.AdminOrSuper)]
public record UpdateGuesthouseCommand(int Id, GuesthouseInput Input) : IRequest;

public class UpdateGuesthouseCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateGuesthouseCommand>
{
    public async Task Handle(UpdateGuesthouseCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.WelfareGuesthouses
            .FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        // Checked on the INCOMING ServiceId, never the stored one: a row already pointing at the
        // wrong service must stay repairable by moving it to the right one.
        await GuesthouseServiceRule.EnsureCanHoldGuesthouseAsync(
            context, request.Input.ServiceId, cancellationToken);

        entity.ServiceId = request.Input.ServiceId;
        entity.Name = request.Input.Name.Trim();
        entity.City = request.Input.City.Trim();
        entity.ManagerName = request.Input.ManagerName.Trim();
        entity.Description = request.Input.Description.Trim();
        entity.IsActive = request.Input.IsActive;

        await context.SaveChangesAsync(cancellationToken);
    }
}

[Authorize(Roles = Roles.AdminOrSuper)]
public record DeleteGuesthouseCommand(int Id) : IRequest;

public class DeleteGuesthouseCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteGuesthouseCommand>
{
    public async Task Handle(DeleteGuesthouseCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.WelfareGuesthouses
            .Include(g => g.Requests)
            .FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        // A guesthouse with history is deactivated, never deleted: the FK is Restrict, and a paid
        // referral must keep pointing at the place it was issued for.
        if (entity.Requests.Count > 0)
        {
            entity.IsActive = false;
        }
        else
        {
            context.WelfareGuesthouses.Remove(entity);
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}
