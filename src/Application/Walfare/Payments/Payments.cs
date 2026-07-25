using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Walfare;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Walfare.Payments;

file static class Fail
{
    public static ValidationException With(string property, string message) =>
        new([new FluentValidation.Results.ValidationFailure(property, message)]);
}

file static class PaymentCompletion
{
    /// <summary>
    /// Mark a transaction verified and, for a pool ticket, flip its reservation to Paid with the
    /// tracking code. Shared by the automatic bank callback and the admin manual «تأیید» so both
    /// paths leave the DB in exactly the same state.
    /// </summary>
    public static async Task ApplyVerifiedAsync(
        IApplicationDbContext context, PaymentTransaction tx, string? description, CancellationToken ct)
    {
        tx.Status = PaymentStatus.Succeeded;
        // Keep the bank's own verify description (e.g. «موفق»), per the merchant's convention.
        tx.Description = description;
        tx.VerifiedAt = DateTimeOffset.UtcNow;

        if (tx.TargetType == InitPoolPaymentCommandHandler.TargetType)
        {
            var reservation = await context.WelfarePoolReservations
                .FirstOrDefaultAsync(r => r.Id == tx.TargetId, ct);
            if (reservation is not null)
            {
                reservation.Status = ReservationStatus.Paid;
                reservation.PaymentTransactionId = tx.Id;
                reservation.TrackingCode = tx.SystemTraceAuditNumber;
            }
        }
    }
}

/// <summary>What the SPA needs to push the payer into the gateway.</summary>
public sealed record PaymentRedirectDto(int TransactionId, string RedirectUrl);

// ── engineer: pay for a reservation ─────────────────────────────────────────

[Authorize]
public record InitPoolPaymentCommand(int ReservationId) : IRequest<PaymentRedirectDto>;

public class InitPoolPaymentCommandHandler(
    IApplicationDbContext context,
    IPaymentGateway gateway,
    IUser user) : IRequestHandler<InitPoolPaymentCommand, PaymentRedirectDto>
{
    public const string TargetType = "pool-reservation";

    public async Task<PaymentRedirectDto> Handle(InitPoolPaymentCommand request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;

        var reservation = await context.WelfarePoolReservations
            .FirstOrDefaultAsync(r => r.Id == request.ReservationId && r.UserId == userId, cancellationToken)
            ?? throw Fail.With("ReservationId", "رزرو موردنظر یافت نشد.");

        if (reservation.Status == ReservationStatus.Paid)
            throw Fail.With("ReservationId", "این رزرو قبلاً پرداخت شده است.");
        if (reservation.Status == ReservationStatus.Cancelled)
            throw Fail.With("ReservationId", "این رزرو لغو شده است.");

        // One ledger row per attempt. A fresh row (and PaymentId) per click keeps the gateway's
        // "duplicate request id" rule happy after an abandoned attempt.
        var tx = new PaymentTransaction
        {
            Gateway = PaymentGateway.IranKish,
            AmountRials = reservation.AmountRials,
            PaymentId = string.Empty,
            Status = PaymentStatus.Initiated,
            TargetType = TargetType,
            TargetId = reservation.Id,
            UserId = userId,
            PayerName = reservation.FullName,
            PayerNationalCode = reservation.NationalCode
        };
        context.PaymentTransactions.Add(tx);
        await context.SaveChangesAsync(cancellationToken); // materialise tx.Id

        // PaymentId must be unique at the gateway; the row id is exactly that.
        tx.PaymentId = tx.Id.ToString();
        var init = await gateway.InitAsync(tx.AmountRials, tx.PaymentId, cancellationToken);

        if (!init.Success || init.RedirectUrl is null)
        {
            tx.Status = PaymentStatus.Failed;
            tx.Description = init.Error;
            await context.SaveChangesAsync(cancellationToken);
            throw Fail.With("ReservationId", init.Error ?? "اتصال به درگاه پرداخت ناموفق بود.");
        }

        tx.Token = init.Token;
        reservation.PaymentTransactionId = tx.Id;
        await context.SaveChangesAsync(cancellationToken);

        return new PaymentRedirectDto(tx.Id, init.RedirectUrl);
    }
}

// ── bank callback (anonymous form POST from Iran Kish) ──────────────────────

/// <summary>
/// Handles the browser's return from the gateway. Returns the FRONT URL to 302 the payer to —
/// nothing here trusts the posted fields alone: success is only recorded after server-to-server
/// verification, and the transaction is located by our own PaymentId + token pair.
/// </summary>
public record HandleIrkCallbackCommand(
    string? ResponseCode,
    string? Token,
    string? PaymentId,
    string? RetrievalReferenceNumber,
    string? SystemTraceAuditNumber,
    string? MaskedPan,
    string? Amount) : IRequest<string>;

public class HandleIrkCallbackCommandHandler(
    IApplicationDbContext context,
    IPaymentGateway gateway,
    IConfiguration configuration,
    ILogger<HandleIrkCallbackCommandHandler> logger) : IRequestHandler<HandleIrkCallbackCommand, string>
{
    public async Task<string> Handle(HandleIrkCallbackCommand request, CancellationToken cancellationToken)
    {
        var front = (configuration["Walfare:FrontBaseUrl"] ?? "https://refahi.kurdnezam.ir").TrimEnd('/');
        string Result(string status, string? tracking = null) =>
            $"{front}/pay/result?status={status}" +
            (tracking is null ? string.Empty : $"&tracking={Uri.EscapeDataString(tracking)}");

        var tx = await context.PaymentTransactions.FirstOrDefaultAsync(
            t => t.PaymentId == request.PaymentId && t.Token == request.Token, cancellationToken);
        if (tx is null)
        {
            logger.LogWarning("IranKish callback for unknown payment {PaymentId}", request.PaymentId);
            return Result("notfound");
        }

        // The gateway can retry the callback; a decided transaction stays decided.
        if (tx.Status == PaymentStatus.Succeeded)
            return Result("ok", tx.SystemTraceAuditNumber);

        // Persist what the bank posted BEFORE deciding — the masked card is worth keeping either
        // way, and a later admin «تأیید» needs the RRN/STAN even if the auto-verify below fails.
        tx.ResponseCode = request.ResponseCode;
        tx.MaskedPan = request.MaskedPan ?? tx.MaskedPan;
        tx.RetrievalReferenceNumber = request.RetrievalReferenceNumber ?? tx.RetrievalReferenceNumber;
        tx.SystemTraceAuditNumber = request.SystemTraceAuditNumber ?? tx.SystemTraceAuditNumber;

        // Iran Kish approves with "0" / "00" / "000". The old check compared against the literal
        // string "0", so a real success ("00") was recorded as FAILED and verify never ran —
        // leaving the payment «موفق تایید نشده» at the bank, which then auto-reverses it.
        if (!IsApprovedCode(request.ResponseCode))
        {
            tx.Status = PaymentStatus.Failed;
            tx.Description = $"بانک پرداخت را نپذیرفت (کد {request.ResponseCode}).";
            await context.SaveChangesAsync(cancellationToken);
            return Result("failed");
        }

        var verify = await gateway.VerifyAsync(
            request.RetrievalReferenceNumber ?? string.Empty,
            request.SystemTraceAuditNumber ?? string.Empty,
            request.Token ?? string.Empty,
            cancellationToken);

        if (!verify.Success)
        {
            // Card was captured but verify failed — keep it PENDING-style (Initiated) so the admin
            // «تأیید» can retry; store the bank's reason so they see why.
            tx.Status = PaymentStatus.Initiated;
            tx.Description = verify.Description ?? "پرداخت انجام شد اما تأیید نشد؛ نیازمند تأیید دستی.";
            await context.SaveChangesAsync(cancellationToken);
            return Result("failed");
        }

        await PaymentCompletion.ApplyVerifiedAsync(context, tx, verify.Description, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);
        return Result("ok", tx.SystemTraceAuditNumber);
    }

    /// <summary>Iran Kish sends the approval code as "0" / "00" / "000" — compare numerically.</summary>
    private static bool IsApprovedCode(string? code) =>
        int.TryParse((code ?? string.Empty).Trim(), out var n) && n == 0;
}

// ── admin: manually verify a payment the callback couldn't (missed/failed verify) ────

/// <summary>
/// Re-runs the bank verify for a transaction the automatic callback left unverified, using the
/// stored Token + RRN + STAN. On success the ticket is marked Paid, exactly like the callback.
/// </summary>
[Authorize(Roles = Roles.Administrator)]
public record ConfirmPaymentCommand(int Id) : IRequest<PaymentTransactionDto>;

public class ConfirmPaymentCommandHandler(
    IApplicationDbContext context,
    IPaymentGateway gateway) : IRequestHandler<ConfirmPaymentCommand, PaymentTransactionDto>
{
    public async Task<PaymentTransactionDto> Handle(ConfirmPaymentCommand request, CancellationToken cancellationToken)
    {
        var tx = await context.PaymentTransactions
            .FirstOrDefaultAsync(t => t.Id == request.Id, cancellationToken)
            ?? throw Fail.With("Id", "تراکنش یافت نشد.");

        if (tx.Status == PaymentStatus.Succeeded) return ToDto(tx); // idempotent

        if (string.IsNullOrWhiteSpace(tx.Token) ||
            string.IsNullOrWhiteSpace(tx.RetrievalReferenceNumber) ||
            string.IsNullOrWhiteSpace(tx.SystemTraceAuditNumber))
        {
            throw Fail.With("Id",
                "این تراکنش اطلاعات ارجاع بانکی (شماره ارجاع/پیگیری) ندارد و قابل تأیید دستی نیست.");
        }

        var verify = await gateway.VerifyAsync(
            tx.RetrievalReferenceNumber!, tx.SystemTraceAuditNumber!, tx.Token!, cancellationToken);

        if (!verify.Success)
        {
            // Return the UPDATED row (don't throw): the caller invalidates on success, so the row
            // refreshes in place and the bank's reason shows under the status without a manual
            // reload. Status stays as-is; the description carries the bank's message.
            tx.Description = verify.Description ?? "بانک این تراکنش را تأیید نکرد.";
            await context.SaveChangesAsync(cancellationToken);
            return ToDto(tx);
        }

        await PaymentCompletion.ApplyVerifiedAsync(context, tx, verify.Description, cancellationToken);
        await context.SaveChangesAsync(cancellationToken);
        return ToDto(tx);
    }

    private static PaymentTransactionDto ToDto(PaymentTransaction t) => new()
    {
        Id = t.Id, Gateway = t.Gateway, AmountRials = t.AmountRials, PaymentId = t.PaymentId,
        Status = t.Status, TargetType = t.TargetType, TargetId = t.TargetId,
        PayerName = t.PayerName, PayerNationalCode = t.PayerNationalCode, MaskedPan = t.MaskedPan,
        RetrievalReferenceNumber = t.RetrievalReferenceNumber, SystemTraceAuditNumber = t.SystemTraceAuditNumber,
        Description = t.Description, Created = t.Created, VerifiedAt = t.VerifiedAt
    };
}

// ── admin: the payment ledger ────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record GetPaymentsAdminQuery(
    PaymentStatus? Status = null,
    string? Q = null,
    int Page = 1,
    int PageSize = 20) : IRequest<WalfarePagedResult<PaymentTransactionDto>>;

public class GetPaymentsAdminQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetPaymentsAdminQuery, WalfarePagedResult<PaymentTransactionDto>>
{
    public async Task<WalfarePagedResult<PaymentTransactionDto>> Handle(
        GetPaymentsAdminQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var query = context.PaymentTransactions.AsNoTracking().AsQueryable();

        if (request.Status is { } status) query = query.Where(t => t.Status == status);
        if (!string.IsNullOrWhiteSpace(request.Q))
        {
            var term = request.Q.Trim();
            query = query.Where(t =>
                t.PayerName.Contains(term) || t.PayerNationalCode.Contains(term) ||
                t.PaymentId.Contains(term) ||
                (t.SystemTraceAuditNumber != null && t.SystemTraceAuditNumber.Contains(term)));
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(t => t.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new PaymentTransactionDto
            {
                Id = t.Id,
                Gateway = t.Gateway,
                AmountRials = t.AmountRials,
                PaymentId = t.PaymentId,
                Status = t.Status,
                TargetType = t.TargetType,
                TargetId = t.TargetId,
                PayerName = t.PayerName,
                PayerNationalCode = t.PayerNationalCode,
                MaskedPan = t.MaskedPan,
                RetrievalReferenceNumber = t.RetrievalReferenceNumber,
                SystemTraceAuditNumber = t.SystemTraceAuditNumber,
                Description = t.Description,
                Created = t.Created,
                VerifiedAt = t.VerifiedAt
            })
            .ToListAsync(cancellationToken);

        return new WalfarePagedResult<PaymentTransactionDto>
        {
            Items = items, Total = total, Page = page, PageSize = pageSize
        };
    }
}
