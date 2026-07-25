using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Walfare;
using Microsoft.EntityFrameworkCore;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Walfare.Reservations;

file static class Fail
{
    public static ValidationException With(string property, string message) =>
        new([new FluentValidation.Results.ValidationFailure(property, message)]);
}

// ── engineer: who am I (org snapshot preview shown before reserving) ─────────

[Authorize]
public record GetWalfareEngineerMeQuery : IRequest<WalfareEngineerDto>;

public class GetWalfareEngineerMeQueryHandler(IEngineerDirectory directory, IUser user)
    : IRequestHandler<GetWalfareEngineerMeQuery, WalfareEngineerDto>
{
    public async Task<WalfareEngineerDto> Handle(GetWalfareEngineerMeQuery request, CancellationToken cancellationToken)
    {
        // Engineer accounts use the کد ملی as the username (see the IdP's EngineerLogin).
        var nationalCode = user.Name ?? string.Empty;
        var info = await directory.GetByNationalCodeAsync(nationalCode, cancellationToken)
            ?? throw Fail.With("NationalCode",
                "برای این حساب پرونده مهندسی یافت نشد؛ خدمات رفاهی فقط با ورود مهندس (کد ملی و کد پیامکی) در دسترس است.");

        return new WalfareEngineerDto
        {
            FullName = info.FullName,
            NationalCode = info.NationalCode,
            ReshteCode = info.ReshteCode,
            Mobile = info.Mobile
        };
    }
}

// ── engineer: reserve a pool for a day ───────────────────────────────────────

[Authorize]
public record CreateReservationCommand(int PoolId, string Date) : IRequest<int>;

public class CreateReservationCommandHandler(
    IApplicationDbContext context,
    IEngineerDirectory directory,
    IUser user) : IRequestHandler<CreateReservationCommand, int>
{
    public async Task<int> Handle(CreateReservationCommand request, CancellationToken cancellationToken)
    {
        var date = JalaliDate.Parse(request.Date)
            ?? throw Fail.With("Date", "تاریخ انتخابی معتبر نیست.");

        var pool = await context.WelfarePools
            .Include(p => p.Service)
            .FirstOrDefaultAsync(p => p.Id == request.PoolId, cancellationToken);
        Guard.Against.NotFound(request.PoolId, pool);

        var service = pool.Service!;
        if (!pool.IsActive || !service.IsAccessible)
            throw Fail.With("PoolId", "این استخر در حال حاضر فعال نیست.");
        if (date < service.StartDate || date > service.EndDate)
            throw Fail.With("Date", "تاریخ انتخابی خارج از بازه این خدمت است.");
        if (!JalaliDate.IsActiveOn(pool.ActiveDays, date))
            throw Fail.With("Date", "این استخر در روز انتخابی فعال نیست.");

        var userId = user.Id ?? throw Fail.With("UserId", "حساب کاربری نامعتبر است.");
        var nationalCode = user.Name ?? string.Empty;

        // One live reservation per engineer per pool per day — pressing "reserve" twice must not
        // double-bill. Cancelled rows don't block a new booking.
        var existing = await context.WelfarePoolReservations.FirstOrDefaultAsync(
            r => r.PoolId == pool.Id && r.Date == date && r.UserId == userId &&
                 r.Status != ReservationStatus.Cancelled,
            cancellationToken);
        if (existing is not null)
        {
            if (existing.Status == ReservationStatus.Paid)
                throw Fail.With("Date", "برای این روز قبلاً بلیط تهیه کرده‌اید (بخش «رزروهای من»).");

            // Still awaiting payment (an abandoned or failed attempt): hand back the SAME
            // reservation so the payment can be retried. Refusing here left the engineer stuck —
            // the booking page could not proceed and only «رزروهای من» offered a way on.
            return existing.Id;
        }

        var taken = await context.WelfarePoolReservations.CountAsync(
            r => r.PoolId == pool.Id && r.Date == date && r.Status != ReservationStatus.Cancelled,
            cancellationToken);
        if (taken >= pool.Capacity)
            throw Fail.With("Date", "ظرفیت این استخر برای روز انتخابی تکمیل شده است.");

        // Snapshot the engineer from the org DB — the ticket keeps saying who bought it even if
        // the membership record changes later.
        var info = await directory.GetByNationalCodeAsync(nationalCode, cancellationToken)
            ?? throw Fail.With("NationalCode",
                "برای این حساب پرونده مهندسی یافت نشد؛ خدمات رفاهی فقط با ورود مهندس (کد ملی و کد پیامکی) در دسترس است.");

        var entity = new WelfarePoolReservation
        {
            PoolId = pool.Id,
            UserId = userId,
            DateJalali = JalaliDate.NormalizeDigits(request.Date),
            Date = date,
            FullName = info.FullName,
            NationalCode = info.NationalCode,
            ReshteCode = info.ReshteCode,
            Mobile = info.Mobile ?? string.Empty,
            AmountRials = pool.PriceRials,
            Status = ReservationStatus.PendingPayment
        };

        context.WelfarePoolReservations.Add(entity);
        await context.SaveChangesAsync(cancellationToken);
        return entity.Id;
    }
}

// ── engineer: my reservations ────────────────────────────────────────────────

[Authorize]
public record GetMyReservationsQuery : IRequest<IReadOnlyList<ReservationDto>>;

public class GetMyReservationsQueryHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<GetMyReservationsQuery, IReadOnlyList<ReservationDto>>
{
    public async Task<IReadOnlyList<ReservationDto>> Handle(
        GetMyReservationsQuery request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;

        return await context.WelfarePoolReservations.AsNoTracking()
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.Id)
            .Select(ReservationMapper.Projection)
            .ToListAsync(cancellationToken);
    }
}

// ── admin: all reservations, paged ──────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record GetReservationsAdminQuery(
    int? PoolId = null,
    ReservationStatus? Status = null,
    string? Q = null,
    int Page = 1,
    int PageSize = 20) : IRequest<WalfarePagedResult<ReservationDto>>;

public class GetReservationsAdminQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetReservationsAdminQuery, WalfarePagedResult<ReservationDto>>
{
    public async Task<WalfarePagedResult<ReservationDto>> Handle(
        GetReservationsAdminQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var query = context.WelfarePoolReservations.AsNoTracking().AsQueryable();

        if (request.PoolId is { } poolId) query = query.Where(r => r.PoolId == poolId);
        if (request.Status is { } status) query = query.Where(r => r.Status == status);
        if (!string.IsNullOrWhiteSpace(request.Q))
        {
            var term = request.Q.Trim();
            query = query.Where(r =>
                r.FullName.Contains(term) || r.NationalCode.Contains(term) ||
                (r.TrackingCode != null && r.TrackingCode.Contains(term)));
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(r => r.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(ReservationMapper.Projection)
            .ToListAsync(cancellationToken);

        return new WalfarePagedResult<ReservationDto>
        {
            Items = items, Total = total, Page = page, PageSize = pageSize
        };
    }
}

internal static class ReservationMapper
{
    /// <summary>
    /// Shared projection as an Expression — a plain method call inside Select() would force
    /// client evaluation and leave <c>r.Pool</c> unloaded (NullReference at runtime). An
    /// expression stays visible to the SQL translator.
    /// </summary>
    public static readonly System.Linq.Expressions.Expression<Func<WelfarePoolReservation, ReservationDto>> Projection =
        r => new ReservationDto
        {
            Id = r.Id,
            PoolId = r.PoolId,
            PoolName = r.Pool!.Name,
            Date = r.DateJalali,
            FullName = r.FullName,
            NationalCode = r.NationalCode,
            ReshteCode = r.ReshteCode,
            Mobile = r.Mobile,
            AmountRials = r.AmountRials,
            Status = r.Status,
            TrackingCode = r.TrackingCode,
            Created = r.Created
        };
}
