using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Application.Walfare.Payments;
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
/// What the payer is shown. Deliberately anonymous.
/// </summary>
/// <remarks>
/// No national code, no membership number, no names — not the applicant's and not the companions'.
/// The token travels in an SMS that can be forwarded to anybody, so this payload must be safe in a
/// stranger's hands. GuesthousePaymentSummaryTests fails if a field is added.
/// </remarks>
public sealed record GuesthousePaymentSummaryDto
{
    public string GuesthouseName { get; init; } = string.Empty;
    public string GuesthouseCity { get; init; } = string.Empty;
    public string CheckInDateJalali { get; init; } = string.Empty;
    public string CheckOutDateJalali { get; init; } = string.Empty;
    public int Nights { get; init; }
    public int GuestCount { get; init; }
    public long AmountRials { get; init; }
    public bool Payable { get; init; }

    /// <summary>Persian sentence when <see cref="Payable"/> is false. Empty otherwise.</summary>
    public string Reason { get; init; } = string.Empty;
}

public static class GuesthousePaymentRules
{
    public static (bool Payable, string Reason) Evaluate(
        GuesthouseRequestStatus status, DateTimeOffset? expiresUtc, DateTimeOffset now)
    {
        if (status == GuesthouseRequestStatus.Paid)
            return (false, "این درخواست قبلاً پرداخت شده است.");
        if (status is GuesthouseRequestStatus.Rejected or GuesthouseRequestStatus.Cancelled)
            return (false, "این درخواست دیگر معتبر نیست.");
        if (!GuesthouseTransitions.CanPay(status))
            return (false, "هنوز مبلغی برای این درخواست تعیین نشده است.");
        if (expiresUtc is null || expiresUtc <= now)
            return (false, "این لینک پرداخت منقضی شده است. لطفاً با امور رفاهی تماس بگیرید.");

        return (true, string.Empty);
    }
}

// ── anonymous: what am I paying for? ────────────────────────────────────────

/// <summary>Resolved by token alone — the payer may have no account, which is the whole point.</summary>
public record GetGuesthousePaymentSummaryQuery(string Token)
    : IRequest<GuesthousePaymentSummaryDto>, ISensitivePayloadRequest;

public class GetGuesthousePaymentSummaryQueryHandler(IApplicationDbContext context, TimeProvider clock)
    : IRequestHandler<GetGuesthousePaymentSummaryQuery, GuesthousePaymentSummaryDto>
{
    public async Task<GuesthousePaymentSummaryDto> Handle(
        GetGuesthousePaymentSummaryQuery request, CancellationToken cancellationToken)
    {
        // Project instead of Include(r => r.Companions): this is an ANONYMOUS request and the only
        // thing it needs from the companions is a count, so the full rows (names, relations) must
        // never be materialised. The count is computed in SQL.
        var entity = await context.GuesthouseRequests
            .AsNoTracking()
            .Where(r => r.PaymentToken == request.Token)
            .Select(r => new
            {
                r.Status,
                r.PaymentTokenExpiresUtc,
                GuesthouseName = r.Guesthouse != null ? r.Guesthouse.Name : null,
                GuesthouseCity = r.Guesthouse != null ? r.Guesthouse.City : null,
                r.CheckInDateJalali,
                r.CheckOutDateJalali,
                r.CheckInDate,
                r.CheckOutDate,
                GuestCount = 1 + r.Companions.Count(c => !c.IsInfant),
                r.AmountRials
            })
            .FirstOrDefaultAsync(cancellationToken)
            ?? throw Fail.With("Token", "این لینک پرداخت معتبر نیست.");

        // Same formula as GuesthouseRequest.Nights, computed here instead of via the entity's
        // getter so the query above stays a single flat SQL projection (no computed-property
        // translation to rely on).
        var nights = Math.Max(0, entity.CheckOutDate.DayNumber - entity.CheckInDate.DayNumber);

        var (payable, reason) = GuesthousePaymentRules.Evaluate(
            entity.Status, entity.PaymentTokenExpiresUtc, clock.GetUtcNow());

        // A dead link (expired, already paid, rejected...) must stop answering questions about
        // somebody's stay. It travels by SMS and can be forwarded into a group chat, so once it is
        // no longer payable we return only the refusal — no guesthouse, dates, guest count or
        // amount — instead of leaving those readable forever.
        if (!payable)
        {
            return new GuesthousePaymentSummaryDto
            {
                Payable = false,
                Reason = reason
            };
        }

        return new GuesthousePaymentSummaryDto
        {
            GuesthouseName = entity.GuesthouseName ?? string.Empty,
            GuesthouseCity = entity.GuesthouseCity ?? string.Empty,
            CheckInDateJalali = entity.CheckInDateJalali,
            CheckOutDateJalali = entity.CheckOutDateJalali,
            Nights = nights,
            GuestCount = entity.GuestCount,
            AmountRials = entity.AmountRials,
            Payable = payable,
            Reason = reason
        };
    }
}

// ── anonymous: start the payment ────────────────────────────────────────────

public record InitGuesthousePaymentCommand(string Token)
    : IRequest<PaymentRedirectDto>, ISensitivePayloadRequest;

public class InitGuesthousePaymentCommandHandler(
    IApplicationDbContext context,
    IPaymentGateway gateway,
    TimeProvider clock) : IRequestHandler<InitGuesthousePaymentCommand, PaymentRedirectDto>
{
    public const string TargetType = "guesthouse-request";

    public async Task<PaymentRedirectDto> Handle(
        InitGuesthousePaymentCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.GuesthouseRequests
            .FirstOrDefaultAsync(r => r.PaymentToken == request.Token, cancellationToken)
            ?? throw Fail.With("Token", "این لینک پرداخت معتبر نیست.");

        var (payable, reason) = GuesthousePaymentRules.Evaluate(
            entity.Status, entity.PaymentTokenExpiresUtc, clock.GetUtcNow());
        if (!payable) throw Fail.With("Token", reason);

        // One ledger row per attempt, same as the pool flow: a fresh PaymentId per click keeps the
        // gateway's "duplicate request id" rule happy after an abandoned attempt.
        var tx = new PaymentTransaction
        {
            Gateway = PaymentGateway.IranKish,
            AmountRials = entity.AmountRials,
            PaymentId = string.Empty,
            Status = PaymentStatus.Initiated,
            TargetType = TargetType,
            TargetId = entity.Id,
            // Empty, not null: the payer may have no account. The request row already records who
            // the stay is for, and PayerName is a display field on the payments report.
            UserId = entity.UserId ?? string.Empty,
            PayerName = entity.FullName,
            PayerNationalCode = entity.NationalCode
        };
        context.PaymentTransactions.Add(tx);
        await context.SaveChangesAsync(cancellationToken);   // materialise tx.Id

        tx.PaymentId = tx.Id.ToString();
        var init = await gateway.InitAsync(tx.AmountRials, tx.PaymentId, cancellationToken);

        if (!init.Success || init.RedirectUrl is null)
        {
            tx.Status = PaymentStatus.Failed;
            tx.Description = init.Error;
            await context.SaveChangesAsync(cancellationToken);
            throw Fail.With("Token", init.Error ?? "اتصال به درگاه پرداخت ناموفق بود.");
        }

        tx.Token = init.Token;
        entity.PaymentTransactionId = tx.Id;
        await context.SaveChangesAsync(cancellationToken);

        return new PaymentRedirectDto(tx.Id, init.RedirectUrl);
    }
}
