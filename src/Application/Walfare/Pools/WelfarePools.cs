using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Walfare;
using Microsoft.EntityFrameworkCore;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Walfare.Pools;

/// <summary>Admin-editable fields of a pool (استخر).</summary>
public sealed record WelfarePoolInput(
    int ServiceId,
    string Name,
    int ActiveDays,
    string Description,
    bool IsActive,
    long PriceRials,
    string ReserveStartTime,
    string ReserveEndTime,
    int Capacity);

// ── engineer: pools offered for a chosen day ─────────────────────────────────

/// <summary>Pools an engineer can reserve on the given Jalali date, with remaining capacity.</summary>
[Authorize]
public record GetPoolsForDateQuery(int ServiceId, string Date) : IRequest<IReadOnlyList<PoolAvailabilityDto>>;

public class GetPoolsForDateQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetPoolsForDateQuery, IReadOnlyList<PoolAvailabilityDto>>
{
    public async Task<IReadOnlyList<PoolAvailabilityDto>> Handle(
        GetPoolsForDateQuery request, CancellationToken cancellationToken)
    {
        var date = JalaliDate.Parse(request.Date)
            ?? throw new ValidationException(
            [
                new FluentValidation.Results.ValidationFailure("Date", "تاریخ انتخابی معتبر نیست.")
            ]);

        var service = await context.WelfareServices.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == request.ServiceId, cancellationToken);
        Guard.Against.NotFound(request.ServiceId, service);

        // The chosen day must fall inside the service window — the calendar greys the rest out,
        // but the API cannot rely on the calendar.
        if (!service.IsAccessible || date < service.StartDate || date > service.EndDate)
            return [];

        var mask = 1 << JalaliDate.WeekdayBit(date);

        var pools = await context.WelfarePools.AsNoTracking()
            .Where(p => p.ServiceId == request.ServiceId && p.IsActive && (p.ActiveDays & mask) != 0)
            .OrderBy(p => p.Name)
            .Select(p => new
            {
                Pool = p,
                Reserved = p.Reservations.Count(r => r.Date == date && r.Status != ReservationStatus.Cancelled)
            })
            .ToListAsync(cancellationToken);

        return pools.Select(x => new PoolAvailabilityDto
        {
            Id = x.Pool.Id,
            Name = x.Pool.Name,
            Description = x.Pool.Description,
            PriceRials = x.Pool.PriceRials,
            ReserveStartTime = x.Pool.ReserveStartTime,
            ReserveEndTime = x.Pool.ReserveEndTime,
            Capacity = x.Pool.Capacity,
            Reserved = x.Reserved,
            Remaining = Math.Max(0, x.Pool.Capacity - x.Reserved)
        }).ToList();
    }
}

// ── engineer: which days of the month carry the service ──────────────────────

/// <summary>
/// Feeds the booking calendar's day badges. Returns the service window and the union of its
/// active pools' weekday masks, so the calendar can mark every month it shows without one
/// request per day.
/// </summary>
[Authorize]
public record GetServiceCalendarQuery(int ServiceId) : IRequest<ServiceCalendarDto>;

public class GetServiceCalendarQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetServiceCalendarQuery, ServiceCalendarDto>
{
    public async Task<ServiceCalendarDto> Handle(
        GetServiceCalendarQuery request, CancellationToken cancellationToken)
    {
        var service = await context.WelfareServices.AsNoTracking()
            .FirstOrDefaultAsync(s => s.Id == request.ServiceId, cancellationToken);
        Guard.Against.NotFound(request.ServiceId, service);

        var pools = await context.WelfarePools.AsNoTracking()
            .Where(p => p.ServiceId == request.ServiceId && p.IsActive)
            .Select(p => new { p.ActiveDays, p.PriceRials })
            .ToListAsync(cancellationToken);

        var mask = 0;
        foreach (var p in pools) mask |= p.ActiveDays;

        return new ServiceCalendarDto
        {
            ServiceId = service.Id,
            Title = service.Title,
            StartDate = JalaliDate.Format(service.StartDate),
            EndDate = JalaliDate.Format(service.EndDate),
            IsAccessible = service.IsAccessible,
            // An inaccessible service offers nothing — the calendar must not badge its days.
            ActiveDays = service.IsAccessible ? mask : 0,
            PoolCount = pools.Count,
            MinPriceRials = pools.Count == 0 ? null : pools.Min(p => p.PriceRials)
        };
    }
}

// ── admin CRUD ───────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record GetWelfarePoolsAdminQuery(int? ServiceId = null) : IRequest<IReadOnlyList<WelfarePoolDto>>;

public class GetWelfarePoolsAdminQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetWelfarePoolsAdminQuery, IReadOnlyList<WelfarePoolDto>>
{
    public async Task<IReadOnlyList<WelfarePoolDto>> Handle(
        GetWelfarePoolsAdminQuery request, CancellationToken cancellationToken)
    {
        var query = context.WelfarePools.AsNoTracking().AsQueryable();
        if (request.ServiceId is { } serviceId)
            query = query.Where(p => p.ServiceId == serviceId);

        return await query
            .OrderBy(p => p.ServiceId).ThenBy(p => p.Name)
            .Select(p => new WelfarePoolDto
            {
                Id = p.Id,
                ServiceId = p.ServiceId,
                Name = p.Name,
                ActiveDays = p.ActiveDays,
                Description = p.Description,
                IsActive = p.IsActive,
                PriceRials = p.PriceRials,
                ReserveStartTime = p.ReserveStartTime,
                ReserveEndTime = p.ReserveEndTime,
                Capacity = p.Capacity
            })
            .ToListAsync(cancellationToken);
    }
}

[Authorize(Roles = Roles.Administrator)]
public record CreateWelfarePoolCommand(WelfarePoolInput Input) : IRequest<int>;

public class CreateWelfarePoolCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateWelfarePoolCommand, int>
{
    public async Task<int> Handle(CreateWelfarePoolCommand request, CancellationToken cancellationToken)
    {
        var entity = WelfarePoolMapper.Apply(new WelfarePool(), request.Input);
        context.WelfarePools.Add(entity);
        await context.SaveChangesAsync(cancellationToken);
        return entity.Id;
    }
}

[Authorize(Roles = Roles.Administrator)]
public record UpdateWelfarePoolCommand(int Id, WelfarePoolInput Input) : IRequest;

public class UpdateWelfarePoolCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateWelfarePoolCommand>
{
    public async Task Handle(UpdateWelfarePoolCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.WelfarePools
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        WelfarePoolMapper.Apply(entity, request.Input);
        await context.SaveChangesAsync(cancellationToken);
    }
}

[Authorize(Roles = Roles.Administrator)]
public record DeleteWelfarePoolCommand(int Id) : IRequest;

public class DeleteWelfarePoolCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteWelfarePoolCommand>
{
    public async Task Handle(DeleteWelfarePoolCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.WelfarePools
            .FirstOrDefaultAsync(p => p.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        // Reservations are Restrict — deleting a pool that sold tickets must fail loudly, not 500.
        var hasReservations = await context.WelfarePoolReservations
            .AnyAsync(r => r.PoolId == request.Id, cancellationToken);
        if (hasReservations)
        {
            throw new ValidationException(
            [
                new FluentValidation.Results.ValidationFailure(
                    "Id", "برای این استخر رزرو ثبت شده است و قابل حذف نیست؛ آن را غیرفعال کنید.")
            ]);
        }

        context.WelfarePools.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

internal static class WelfarePoolMapper
{
    public static WelfarePool Apply(WelfarePool entity, WelfarePoolInput input)
    {
        entity.ServiceId = input.ServiceId;
        entity.Name = input.Name.Trim();
        entity.ActiveDays = input.ActiveDays;
        entity.Description = input.Description.Trim();
        entity.IsActive = input.IsActive;
        entity.PriceRials = input.PriceRials;
        entity.ReserveStartTime = JalaliDate.NormalizeDigits(input.ReserveStartTime);
        entity.ReserveEndTime = JalaliDate.NormalizeDigits(input.ReserveEndTime);
        entity.Capacity = input.Capacity;
        return entity;
    }
}

public class WelfarePoolInputValidator : AbstractValidator<WelfarePoolInput>
{
    public WelfarePoolInputValidator(IApplicationDbContext context)
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Description).MaximumLength(2000);
        RuleFor(x => x.ActiveDays).InclusiveBetween(1, 127)
            .WithMessage("دست‌کم یک روز فعال انتخاب کنید.");
        RuleFor(x => x.PriceRials).GreaterThan(0)
            .WithMessage("مبلغ باید بزرگ‌تر از صفر باشد.");
        RuleFor(x => x.Capacity).GreaterThan(0)
            .WithMessage("ظرفیت باید بزرگ‌تر از صفر باشد.");
        RuleFor(x => x.ReserveStartTime).NotEmpty().MaximumLength(10);
        RuleFor(x => x.ReserveEndTime).NotEmpty().MaximumLength(10);
        RuleFor(x => x.ServiceId)
            .MustAsync(async (id, ct) => await context.WelfareServices.AnyAsync(s => s.Id == id, ct))
            .WithMessage("خدمت رفاهی انتخابی وجود ندارد.");
    }
}

public class CreateWelfarePoolCommandValidator : AbstractValidator<CreateWelfarePoolCommand>
{
    public CreateWelfarePoolCommandValidator(IApplicationDbContext context)
        => RuleFor(x => x.Input).SetValidator(new WelfarePoolInputValidator(context));
}

public class UpdateWelfarePoolCommandValidator : AbstractValidator<UpdateWelfarePoolCommand>
{
    public UpdateWelfarePoolCommandValidator(IApplicationDbContext context)
        => RuleFor(x => x.Input).SetValidator(new WelfarePoolInputValidator(context));
}
