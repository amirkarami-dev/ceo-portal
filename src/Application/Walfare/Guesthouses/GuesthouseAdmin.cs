using System.Security.Cryptography;
using Ardalis.GuardClauses;
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
/// The only place that says which moves are legal. Handlers ask; they never re-derive.
/// </summary>
public static class GuesthouseTransitions
{
    /// <summary>Re-pricing a priced request is allowed — the amount is correctable until it is paid.</summary>
    public static bool CanPrice(GuesthouseRequestStatus s) =>
        s is GuesthouseRequestStatus.Submitted or GuesthouseRequestStatus.Priced;

    public static bool CanReject(GuesthouseRequestStatus s) =>
        s is GuesthouseRequestStatus.Submitted or GuesthouseRequestStatus.Priced;

    public static bool CanCancel(GuesthouseRequestStatus s) =>
        s is GuesthouseRequestStatus.Submitted or GuesthouseRequestStatus.Priced;

    public static bool CanPay(GuesthouseRequestStatus s) => s is GuesthouseRequestStatus.Priced;

    /// <summary>
    /// A typo guard, not a business rule — deliberately generous. 5 billion rials = 500 million
    /// tomans. Nothing legitimate should ever hit this; it exists so an extra zero or two doesn't
    /// mint a live payment link for the wrong price.
    /// </summary>
    public const long MaxAmountRials = 5_000_000_000;
}

public static class GuesthouseTokens
{
    /// <summary>How long a payment link stays open.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

    /// <summary>32 random bytes, base64url, unpadded — safe in an SMS and in a URL.</summary>
    public static string Mint()
    {
        Span<byte> bytes = stackalloc byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }
}

// ── admin: confirm and price ────────────────────────────────────────────────

/// <summary>
/// Confirms a request and sets what it costs. This is what makes it payable.
/// </summary>
/// <remarks>
/// The token is minted HERE, not at submission: a token on a request with no amount is a payable
/// link for a price nobody has set. Re-pricing keeps the same token and only extends its life —
/// a second live link for one request is how somebody pays twice.
/// </remarks>
[Authorize(Roles = Roles.AdminOrSuper)]
public record PriceGuesthouseRequestCommand(
    int Id,
    long AmountRials,
    string AdminNote,
    ApplicantGender? Gender) : IRequest;

public class PriceGuesthouseRequestCommandHandler(IApplicationDbContext context, TimeProvider clock)
    : IRequestHandler<PriceGuesthouseRequestCommand>
{
    public async Task Handle(PriceGuesthouseRequestCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.GuesthouseRequests
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        if (!GuesthouseTransitions.CanPrice(entity.Status))
            throw Fail.With(nameof(request.Id), "این درخواست در وضعیتی نیست که بتوان مبلغ آن را تعیین کرد.");

        if (request.AmountRials <= 0)
            throw Fail.With(nameof(request.AmountRials), "مبلغ باید بیشتر از صفر باشد.");

        // A ceiling, because this is money and the only other check is "> 0". A stay priced at
        // ten billion rials is a typo, not a booking, and the payer sees only the number.
        if (request.AmountRials > GuesthouseTransitions.MaxAmountRials)
            throw Fail.With(nameof(request.AmountRials), "مبلغ واردشده بیش از حد مجاز است.");

        entity.AmountRials = request.AmountRials;
        entity.AdminNote = request.AdminNote?.Trim() ?? string.Empty;
        if (request.Gender is not null) entity.Gender = request.Gender;

        entity.PaymentToken ??= GuesthouseTokens.Mint();
        entity.PaymentTokenExpiresUtc = clock.GetUtcNow().Add(GuesthouseTokens.Lifetime);
        entity.Status = GuesthouseRequestStatus.Priced;

        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── admin: refuse ───────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record RejectGuesthouseRequestCommand(int Id, string Reason) : IRequest;

public class RejectGuesthouseRequestCommandHandler(IApplicationDbContext context)
    : IRequestHandler<RejectGuesthouseRequestCommand>
{
    public async Task Handle(RejectGuesthouseRequestCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.GuesthouseRequests
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        if (!GuesthouseTransitions.CanReject(entity.Status))
            throw Fail.With(nameof(request.Id), "این درخواست قابل رد کردن نیست.");

        if (string.IsNullOrWhiteSpace(request.Reason))
            throw Fail.With(nameof(request.Reason), "دلیل رد درخواست را بنویسید.");

        entity.Status = GuesthouseRequestStatus.Rejected;
        entity.AdminNote = request.Reason.Trim();

        // A refused request must not keep a live payment link.
        entity.PaymentToken = null;
        entity.PaymentTokenExpiresUtc = null;

        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── admin: the list ─────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record GetGuesthouseRequestsAdminQuery(
    GuesthouseRequestStatus? Status = null,
    int? GuesthouseId = null,
    int Page = 1,
    int PageSize = 20) : IRequest<WalfarePagedResult<GuesthouseRequestDto>>;

public class GetGuesthouseRequestsAdminQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetGuesthouseRequestsAdminQuery, WalfarePagedResult<GuesthouseRequestDto>>
{
    public async Task<WalfarePagedResult<GuesthouseRequestDto>> Handle(
        GetGuesthouseRequestsAdminQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var query = context.GuesthouseRequests
            .AsNoTracking()
            .Include(r => r.Guesthouse)
            .Include(r => r.Companions)
            .AsQueryable();

        if (request.Status is not null) query = query.Where(r => r.Status == request.Status);
        if (request.GuesthouseId is not null) query = query.Where(r => r.GuesthouseId == request.GuesthouseId);

        var total = await query.CountAsync(cancellationToken);
        var rows = await query
            .OrderByDescending(r => r.CheckInDate)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return new WalfarePagedResult<GuesthouseRequestDto>
        {
            Items = rows.Select(GuesthouseProjection.ToDto).ToList(), Total = total, Page = page, PageSize = pageSize
        };
    }
}
