using System.Security.Cryptography;
using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Walfare;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
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

    /// <summary>
    /// The furthest out a link may ever be pushed, however many times it is re-sent. Without this
    /// the 7-day expiry is not a bound at all — each re-send simply restarts it.
    /// </summary>
    public static readonly TimeSpan MaxLifetime = TimeSpan.FromDays(30);

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
        // Set once. The re-send handler measures its absolute ceiling from THIS instant, not from
        // whatever PaymentTokenExpiresUtc happens to hold — every re-send overwrites that field.
        entity.FirstPricedAtUtc ??= clock.GetUtcNow();
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

// ── admin: send the payment link by SMS ─────────────────────────────────────

public static class GuesthouseSmsText
{
    /// <summary>
    /// The message body. Short on purpose: Persian is two bytes per character in UTF-8 and a long
    /// message bills as several parts.
    /// </summary>
    /// <remarks>
    /// Carries no personal detail. Anyone can read an SMS over a shoulder, and the link behind it
    /// already shows only the stay and the amount.
    /// </remarks>
    public static string Build(string guesthouseName, long amountRials, string url)
    {
        var tomans = ToPersianDigits((amountRials / 10).ToString("#,##0"));
        return $"درخواست {guesthouseName} تأیید شد.\nمبلغ: {tomans} تومان\nپرداخت:\n{url}";
    }

    private static string ToPersianDigits(string value)
    {
        var sb = new System.Text.StringBuilder(value.Length);
        foreach (var ch in value)
        {
            if (ch is >= '0' and <= '9') sb.Append((char)('۰' + (ch - '0')));
            else if (ch == ',') sb.Append('٬');   // Persian thousands separator
            else sb.Append(ch);
        }
        return sb.ToString();
    }
}

/// <summary>
/// Sends — or re-sends — the payment link to the mobile already on the request.
/// </summary>
/// <remarks>
/// Re-sending re-uses the same token and only extends its life. A second live link for one request
/// is how somebody pays twice.
/// </remarks>
[Authorize(Roles = Roles.AdminOrSuper)]
public record SendGuesthousePaymentSmsCommand(int Id) : IRequest;

public class SendGuesthousePaymentSmsCommandHandler(
    IApplicationDbContext context,
    ISmsSender sms,
    TimeProvider clock,
    IConfiguration configuration) : IRequestHandler<SendGuesthousePaymentSmsCommand>
{
    public async Task Handle(SendGuesthousePaymentSmsCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.GuesthouseRequests
            .Include(r => r.Guesthouse)
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        if (entity.Status != GuesthouseRequestStatus.Priced)
            throw Fail.With(nameof(request.Id),
                "فقط برای درخواستی که مبلغ آن تعیین شده می‌توان لینک پرداخت فرستاد.");

        if (string.IsNullOrWhiteSpace(entity.Mobile))
            throw Fail.With("Mobile", "شماره همراهی برای این درخواست ثبت نشده است.");

        entity.PaymentToken ??= GuesthouseTokens.Mint();

        // Re-sending extends the link by another Lifetime, but never past FirstPricedAtUtc +
        // MaxLifetime — otherwise repeated re-sends keep an anonymous, unauthenticated payment link
        // alive forever. The ceiling MUST be measured from FirstPricedAtUtc, not derived from
        // PaymentTokenExpiresUtc: that field is overwritten by every send, so a ceiling computed
        // from it moves forward with every re-send and never actually binds. A request priced
        // before this column existed has no FirstPricedAtUtc and so no ceiling to respect.
        var extended = clock.GetUtcNow().Add(GuesthouseTokens.Lifetime);
        if (entity.FirstPricedAtUtc is { } firstPriced)
        {
            var ceiling = firstPriced + GuesthouseTokens.MaxLifetime;
            if (ceiling <= clock.GetUtcNow())
                throw Fail.With("Id",
                    "این درخواست بیش از حد مجاز تمدید شده است. برای ارسال دوباره، مبلغ را از نو تعیین کنید.");
            entity.PaymentTokenExpiresUtc = extended < ceiling ? extended : ceiling;
        }
        else
        {
            entity.PaymentTokenExpiresUtc = extended;
        }

        await context.SaveChangesAsync(cancellationToken);

        // The welfare front end's own origin, e.g. https://refahi.kurdnezam.ir
        var baseUrl = (configuration["Walfare:WebBaseUrl"] ?? string.Empty).TrimEnd('/');
        if (baseUrl.Length == 0)
            throw Fail.With("Configuration", "آدرس سامانه رفاهی تنظیم نشده است.");

        var url = $"{baseUrl}/pay/guesthouse/{entity.PaymentToken}";
        var text = GuesthouseSmsText.Build(entity.Guesthouse?.Name ?? "مهمانسرا", entity.AmountRials, url);

        var accepted = await sms.SendAsync(entity.Mobile, text, cancellationToken);

        // Reported, never assumed. A channel that fails silently tells the admin "sent" about a
        // message nobody received.
        if (!accepted)
            throw Fail.With("Sms", "ارسال پیامک ناموفق بود. لطفاً دوباره تلاش کنید.");
    }
}

// ── admin: the referral letter's data, and a hand-editable receipt number ──

public static class GuesthouseReferral
{
    /// <summary>«جناب آقای مهندس» / «سرکار خانم مهندس».</summary>
    /// <exception cref="InvalidOperationException">
    /// When gender is unset. Deliberate: a letter addressed with the wrong honorific is worse than
    /// a letter that has not printed yet, and a first name is not evidence.
    /// </exception>
    public static string Title(ApplicantGender? gender) => gender switch
    {
        ApplicantGender.Male => "جناب آقای مهندس",
        ApplicantGender.Female => "سرکار خانم مهندس",
        _ => throw new InvalidOperationException("gender is not set")
    };
}

/// <summary>Everything the printed معرفی‌نامه needs, and nothing else.</summary>
public sealed record GuesthouseReferralDto
{
    public int Id { get; init; }
    public string GuesthouseName { get; init; } = string.Empty;
    public string GuesthouseCity { get; init; } = string.Empty;
    public string ManagerName { get; init; } = string.Empty;

    /// <summary>Already rendered — «جناب آقای مهندس» or «سرکار خانم مهندس».</summary>
    public string ApplicantTitle { get; init; } = string.Empty;

    public string FullName { get; init; } = string.Empty;
    public string CheckInDateJalali { get; init; } = string.Empty;
    public string CheckOutDateJalali { get; init; } = string.Empty;
    public int Nights { get; init; }
    public int GuestCount { get; init; }
    public string ReceiptNumber { get; init; } = string.Empty;
    public CompanionDto[] Companions { get; init; } = [];
}

[Authorize(Roles = Roles.AdminOrSuper)]
public record GetGuesthouseReferralQuery(int Id) : IRequest<GuesthouseReferralDto>;

public class GetGuesthouseReferralQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetGuesthouseReferralQuery, GuesthouseReferralDto>
{
    public async Task<GuesthouseReferralDto> Handle(
        GetGuesthouseReferralQuery request, CancellationToken cancellationToken)
    {
        var entity = await context.GuesthouseRequests
            .AsNoTracking()
            .Include(r => r.Guesthouse)
            .Include(r => r.Companions)
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        // The letter cites شماره فیش, so it exists only once money has actually arrived.
        if (entity.Status != GuesthouseRequestStatus.Paid)
            throw Fail.With(nameof(request.Id), "معرفی‌نامه فقط پس از پرداخت صادر می‌شود.");

        if (entity.Gender is null)
            throw Fail.With("Gender", "برای صدور معرفی‌نامه، «جناب آقای / سرکار خانم» را مشخص کنید.");

        return new GuesthouseReferralDto
        {
            Id = entity.Id,
            GuesthouseName = entity.Guesthouse?.Name ?? string.Empty,
            GuesthouseCity = entity.Guesthouse?.City ?? string.Empty,
            ManagerName = entity.Guesthouse?.ManagerName ?? string.Empty,
            ApplicantTitle = GuesthouseReferral.Title(entity.Gender),
            FullName = entity.FullName,
            CheckInDateJalali = entity.CheckInDateJalali,
            CheckOutDateJalali = entity.CheckOutDateJalali,
            Nights = entity.Nights,
            GuestCount = entity.GuestCount,
            ReceiptNumber = entity.ReceiptNumber,
            Companions = entity.Companions
                .Select(c => new CompanionDto(
                    c.FullName,
                    c.Relation is null ? null : (CompanionRelationInput)(int)c.Relation,
                    c.IsInfant))
                .ToArray()
        };
    }
}

/// <summary>
/// Corrects شماره فیش by hand, when the gateway's reference is wrong or missing.
///
/// This does NOT record a payment. Only a verified gateway transaction moves a request to Paid, so
/// editing this on an unpaid request changes the number and nothing else — the referral letter still
/// refuses to print. Recording an offline payment is deliberately out of scope; see the spec.
/// </summary>
[Authorize(Roles = Roles.AdminOrSuper)]
public record UpdateGuesthouseReceiptCommand(int Id, string ReceiptNumber) : IRequest;

public class UpdateGuesthouseReceiptCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateGuesthouseReceiptCommand>
{
    public async Task Handle(UpdateGuesthouseReceiptCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.GuesthouseRequests
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        if (string.IsNullOrWhiteSpace(request.ReceiptNumber))
            throw Fail.With(nameof(request.ReceiptNumber), "شماره فیش را وارد کنید.");

        entity.ReceiptNumber = request.ReceiptNumber.Trim();
        await context.SaveChangesAsync(cancellationToken);
    }
}
