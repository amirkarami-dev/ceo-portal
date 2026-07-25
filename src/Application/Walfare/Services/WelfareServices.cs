using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Walfare;
using Microsoft.EntityFrameworkCore;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Walfare.Services;

/// <summary>Admin-editable fields of a welfare offering. Dates are Jalali strings.</summary>
public sealed record WelfareServiceInput(
    WelfareServiceType Type,
    string Title,
    string StartDate,
    string EndDate,
    string ActivationDate,
    bool IsAccessible);

// ── engineer: what can I use today? ─────────────────────────────────────────

[Authorize]
public record GetActiveWelfareServicesQuery : IRequest<IReadOnlyList<WelfareServiceDto>>;

public class GetActiveWelfareServicesQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetActiveWelfareServicesQuery, IReadOnlyList<WelfareServiceDto>>
{
    public async Task<IReadOnlyList<WelfareServiceDto>> Handle(
        GetActiveWelfareServicesQuery request, CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(3.5).Date); // Iran local day

        return await context.WelfareServices.AsNoTracking()
            .Where(s => s.IsAccessible && s.ActivationDate <= today && s.EndDate >= today)
            .OrderBy(s => s.Id)
            .Select(s => new WelfareServiceDto
            {
                Id = s.Id,
                Type = s.Type,
                Title = s.Title,
                StartDate = s.StartDateJalali,
                EndDate = s.EndDateJalali,
                ActivationDate = s.ActivationDateJalali,
                IsAccessible = s.IsAccessible,
                PoolCount = s.Pools.Count(p => p.IsActive)
            })
            .ToListAsync(cancellationToken);
    }
}

// ── admin CRUD ───────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record GetWelfareServicesAdminQuery : IRequest<IReadOnlyList<WelfareServiceDto>>;

public class GetWelfareServicesAdminQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetWelfareServicesAdminQuery, IReadOnlyList<WelfareServiceDto>>
{
    public async Task<IReadOnlyList<WelfareServiceDto>> Handle(
        GetWelfareServicesAdminQuery request, CancellationToken cancellationToken) =>
        await context.WelfareServices.AsNoTracking()
            .OrderByDescending(s => s.Id)
            .Select(s => new WelfareServiceDto
            {
                Id = s.Id,
                Type = s.Type,
                Title = s.Title,
                StartDate = s.StartDateJalali,
                EndDate = s.EndDateJalali,
                ActivationDate = s.ActivationDateJalali,
                IsAccessible = s.IsAccessible,
                PoolCount = s.Pools.Count
            })
            .ToListAsync(cancellationToken);
}

[Authorize(Roles = Roles.Administrator)]
public record CreateWelfareServiceCommand(WelfareServiceInput Input) : IRequest<int>;

public class CreateWelfareServiceCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateWelfareServiceCommand, int>
{
    public async Task<int> Handle(CreateWelfareServiceCommand request, CancellationToken cancellationToken)
    {
        var entity = WelfareServiceMapper.Apply(new WelfareService(), request.Input);
        context.WelfareServices.Add(entity);
        await context.SaveChangesAsync(cancellationToken);
        return entity.Id;
    }
}

[Authorize(Roles = Roles.Administrator)]
public record UpdateWelfareServiceCommand(int Id, WelfareServiceInput Input) : IRequest;

public class UpdateWelfareServiceCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateWelfareServiceCommand>
{
    public async Task Handle(UpdateWelfareServiceCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.WelfareServices
            .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        WelfareServiceMapper.Apply(entity, request.Input);
        await context.SaveChangesAsync(cancellationToken);
    }
}

[Authorize(Roles = Roles.Administrator)]
public record DeleteWelfareServiceCommand(int Id) : IRequest;

public class DeleteWelfareServiceCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteWelfareServiceCommand>
{
    public async Task Handle(DeleteWelfareServiceCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.WelfareServices
            .FirstOrDefaultAsync(s => s.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        // Pools cascade, but a pool with PAID reservations is Restrict-protected — the delete
        // fails at the database rather than erasing sold tickets. Surface that clearly.
        var hasReservations = await context.WelfarePoolReservations
            .AnyAsync(r => r.Pool!.ServiceId == request.Id, cancellationToken);
        if (hasReservations)
        {
            throw new ValidationException(
            [
                new FluentValidation.Results.ValidationFailure(
                    "Id", "برای این خدمت رزرو ثبت شده است و قابل حذف نیست؛ آن را غیرفعال کنید.")
            ]);
        }

        context.WelfareServices.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

internal static class WelfareServiceMapper
{
    public static WelfareService Apply(WelfareService entity, WelfareServiceInput input)
    {
        entity.Type = input.Type;
        entity.Title = input.Title.Trim();
        entity.StartDateJalali = JalaliDate.NormalizeDigits(input.StartDate);
        entity.EndDateJalali = JalaliDate.NormalizeDigits(input.EndDate);
        entity.ActivationDateJalali = JalaliDate.NormalizeDigits(input.ActivationDate);
        entity.StartDate = JalaliDate.Parse(input.StartDate)!.Value;
        entity.EndDate = JalaliDate.Parse(input.EndDate)!.Value;
        entity.ActivationDate = JalaliDate.Parse(input.ActivationDate)!.Value;
        entity.IsAccessible = input.IsAccessible;
        return entity;
    }
}

public class WelfareServiceInputValidator : AbstractValidator<WelfareServiceInput>
{
    public WelfareServiceInputValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.StartDate).Must(d => JalaliDate.Parse(d) is not null)
            .WithMessage("تاریخ شروع معتبر نیست (مثال: ۱۴۰۵/۰۵/۰۱).");
        RuleFor(x => x.EndDate).Must(d => JalaliDate.Parse(d) is not null)
            .WithMessage("تاریخ پایان معتبر نیست.");
        RuleFor(x => x.ActivationDate).Must(d => JalaliDate.Parse(d) is not null)
            .WithMessage("تاریخ فعال‌سازی معتبر نیست.");
        RuleFor(x => x)
            .Must(x => JalaliDate.Parse(x.StartDate) <= JalaliDate.Parse(x.EndDate))
            .When(x => JalaliDate.Parse(x.StartDate) is not null && JalaliDate.Parse(x.EndDate) is not null)
            .WithMessage("تاریخ پایان باید بعد از تاریخ شروع باشد.")
            .OverridePropertyName("EndDate");
    }
}

public class CreateWelfareServiceCommandValidator : AbstractValidator<CreateWelfareServiceCommand>
{
    public CreateWelfareServiceCommandValidator()
        => RuleFor(x => x.Input).SetValidator(new WelfareServiceInputValidator());
}

public class UpdateWelfareServiceCommandValidator : AbstractValidator<UpdateWelfareServiceCommand>
{
    public UpdateWelfareServiceCommandValidator()
        => RuleFor(x => x.Input).SetValidator(new WelfareServiceInputValidator());
}
