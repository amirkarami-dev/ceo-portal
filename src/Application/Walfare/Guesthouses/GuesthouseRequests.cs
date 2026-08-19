using Ardalis.GuardClauses;
using FluentValidation;
using Mabhas19.Application.Common;
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

/// <summary>Mirrors <see cref="CompanionRelation"/> on the wire. Numbers, not strings.</summary>
public enum CompanionRelationInput
{
    Spouse = 0,
    Child = 1,
    Father = 2,
    Mother = 3,
    Brother = 4,
    Sister = 5,
    Other = 6
}

public sealed record CompanionInput(string FullName, CompanionRelationInput? Relation, bool IsInfant);

public sealed record GuesthouseRequestInput(
    int GuesthouseId,
    string FullName,
    string NationalCode,
    string MembershipNumber,
    string Mobile,
    string CheckInDate,
    string CheckOutDate,
    CompanionInput[] Companions);

public class GuesthouseRequestInputValidator : AbstractValidator<GuesthouseRequestInput>
{
    public GuesthouseRequestInputValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().WithMessage("نام و نام خانوادگی الزامی است.").MaximumLength(200);

        RuleFor(x => x.NationalCode)
            .Must(c => Digits(c).Length == 10)
            .WithMessage("کد ملی باید ۱۰ رقم باشد.");

        RuleFor(x => x.Mobile)
            .Must(m => Digits(m).Length == 11)
            .WithMessage("شماره همراه باید ۱۱ رقم باشد.");

        RuleFor(x => x.MembershipNumber)
            .Must(m => Digits(m).Length <= 50)
            .WithMessage("شماره عضویت نامعتبر است.");

        RuleFor(x => x.CheckInDate)
            .Must(d => JalaliDate.Parse(d) is not null)
            .WithMessage("تاریخ ورود معتبر نیست.");

        RuleFor(x => x.CheckOutDate)
            .Must(d => JalaliDate.Parse(d) is not null)
            .WithMessage("تاریخ خروج معتبر نیست.");

        RuleFor(x => x.CheckOutDate)
            .Must((input, _) =>
            {
                var inDate = JalaliDate.Parse(input.CheckInDate);
                var outDate = JalaliDate.Parse(input.CheckOutDate);
                return inDate is null || outDate is null || outDate > inDate;
            })
            .WithMessage("تاریخ خروج باید بعد از تاریخ ورود باشد.");

        // A body that omits "companions" binds this to null, and a solo applicant is the
        // commonest request of all. Without this the count rules below dereference null and
        // the caller gets a 500 instead of a sentence they can read.
        RuleFor(x => x.Companions)
            .NotNull().WithMessage("فهرست همراهان نامعتبر است.");

        RuleFor(x => x.Companions)
            .Must(c => c is null || c.Count(p => !p.IsInfant) <= 5)
            .WithMessage("حداکثر ۵ همراه می‌توانید ثبت کنید.");

        RuleFor(x => x.Companions)
            .Must(c => c is null || c.Count(p => p.IsInfant) <= 2)
            .WithMessage("حداکثر ۲ کودک زیر دو سال می‌توانید ثبت کنید.");

        RuleForEach(x => x.Companions).ChildRules(c =>
            c.RuleFor(p => p.FullName).NotEmpty().WithMessage("نام همراه الزامی است.").MaximumLength(200));
    }

    /// <summary>
    /// Keeps ONLY digits, after folding Persian and Arabic-Indic ones to ASCII.
    /// </summary>
    /// <remarks>
    /// Not <c>Trim()</c>. A national code pasted out of a message carries an invisible direction
    /// mark that is not whitespace, so the value arrives one character longer than it looks and a
    /// length check refuses a perfectly good code. That exact bug locked an engineer out of this
    /// very service — see docs/ai/GOTCHAS.md.
    /// </remarks>
    internal static string Digits(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;

        var sb = new System.Text.StringBuilder(value.Length);
        foreach (var ch in value)
        {
            if (ch is >= '0' and <= '9') sb.Append(ch);
            else if (ch is >= '۰' and <= '۹') sb.Append((char)('0' + (ch - '۰')));
            else if (ch is >= '٠' and <= '٩') sb.Append((char)('0' + (ch - '٠')));
        }
        return sb.ToString();
    }
}

/// <summary>
/// Bridges the input validator onto the command.
/// </summary>
/// <remarks>
/// Without this the rules above are DEAD CODE. `ValidationBehaviour` resolves
/// `IValidator&lt;TRequest&gt;` where TRequest is the command, so an `AbstractValidator&lt;SomeInput&gt;`
/// is never found and never runs — while unit tests that construct it directly still pass.
/// `WelfarePools.cs` bridges the same way.
/// </remarks>
public class CreateGuesthouseRequestCommandValidator : AbstractValidator<CreateGuesthouseRequestCommand>
{
    public CreateGuesthouseRequestCommandValidator()
        => RuleFor(x => x.Input).SetValidator(new GuesthouseRequestInputValidator());
}

public class CreateGuesthouseRequestAdminCommandValidator
    : AbstractValidator<CreateGuesthouseRequestAdminCommand>
{
    public CreateGuesthouseRequestAdminCommandValidator()
        => RuleFor(x => x.Input).SetValidator(new GuesthouseRequestInputValidator());
}

public sealed record CompanionDto(string FullName, CompanionRelationInput? Relation, bool IsInfant);

public sealed record GuesthouseRequestDto
{
    public int Id { get; init; }
    public int GuesthouseId { get; init; }
    public string GuesthouseName { get; init; } = string.Empty;
    public string GuesthouseCity { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string NationalCode { get; init; } = string.Empty;
    public string MembershipNumber { get; init; } = string.Empty;
    public string Mobile { get; init; } = string.Empty;
    public ApplicantGender? Gender { get; init; }
    public string CheckInDateJalali { get; init; } = string.Empty;
    public string CheckOutDateJalali { get; init; } = string.Empty;
    public int Nights { get; init; }
    public int GuestCount { get; init; }
    public long AmountRials { get; init; }
    public string AdminNote { get; init; } = string.Empty;
    public GuesthouseRequestStatus Status { get; init; }
    public string ReceiptNumber { get; init; } = string.Empty;
    public bool CreatedByAdmin { get; init; }

    /// <summary>
    /// Only ever sent to the row's OWNER or to an admin — it is what their own pay button opens.
    /// Never on the anonymous payment payload.
    /// </summary>
    public string? PaymentToken { get; init; }

    public DateTimeOffset? PaidAtUtc { get; init; }
    public CompanionDto[] Companions { get; init; } = [];
}

/// <summary>Shared projection so the member list and the admin list cannot drift apart.</summary>
internal static class GuesthouseProjection
{
    public static GuesthouseRequestDto ToDto(GuesthouseRequest r) => new()
    {
        Id = r.Id,
        GuesthouseId = r.GuesthouseId,
        GuesthouseName = r.Guesthouse?.Name ?? string.Empty,
        GuesthouseCity = r.Guesthouse?.City ?? string.Empty,
        FullName = r.FullName,
        NationalCode = r.NationalCode,
        MembershipNumber = r.MembershipNumber,
        Mobile = r.Mobile,
        Gender = r.Gender,
        CheckInDateJalali = r.CheckInDateJalali,
        CheckOutDateJalali = r.CheckOutDateJalali,
        Nights = r.Nights,
        GuestCount = r.GuestCount,
        AmountRials = r.AmountRials,
        AdminNote = r.AdminNote,
        Status = r.Status,
        ReceiptNumber = r.ReceiptNumber,
        CreatedByAdmin = r.CreatedByAdmin,
        PaymentToken = r.PaymentToken,
        PaidAtUtc = r.PaidAtUtc,
        Companions = r.Companions
            .Select(c => new CompanionDto(
                c.FullName,
                c.Relation is null ? null : (CompanionRelationInput)(int)c.Relation,
                c.IsInfant))
            .ToArray()
    };
}

internal static class GuesthouseRequestFactory
{
    public static GuesthouseRequest Build(GuesthouseRequestInput input, string? userId, bool byAdmin)
    {
        var checkIn = JalaliDate.Parse(input.CheckInDate)
            ?? throw Fail.With(nameof(input.CheckInDate), "تاریخ ورود معتبر نیست.");
        var checkOut = JalaliDate.Parse(input.CheckOutDate)
            ?? throw Fail.With(nameof(input.CheckOutDate), "تاریخ خروج معتبر نیست.");

        var entity = new GuesthouseRequest
        {
            GuesthouseId = input.GuesthouseId,
            UserId = userId,
            CreatedByAdmin = byAdmin,
            Status = GuesthouseRequestStatus.Submitted,
            FullName = input.FullName.Trim(),
            NationalCode = GuesthouseRequestInputValidator.Digits(input.NationalCode),
            MembershipNumber = GuesthouseRequestInputValidator.Digits(input.MembershipNumber),
            Mobile = GuesthouseRequestInputValidator.Digits(input.Mobile),
            CheckInDateJalali = input.CheckInDate.Trim(),
            CheckOutDateJalali = input.CheckOutDate.Trim(),
            CheckInDate = checkIn,
            CheckOutDate = checkOut
        };

        foreach (var c in input.Companions ?? [])
        {
            entity.Companions.Add(new GuesthouseCompanion
            {
                FullName = c.FullName.Trim(),
                // An infant has no نسبت column on the paper form, so none is stored for one.
                Relation = c.IsInfant || c.Relation is null ? null : (CompanionRelation)(int)c.Relation,
                IsInfant = c.IsInfant
            });
        }

        return entity;
    }
}

// ── member submits ──────────────────────────────────────────────────────────

[Authorize]
public record CreateGuesthouseRequestCommand(GuesthouseRequestInput Input)
    : IRequest<int>, ISensitivePayloadRequest;

public class CreateGuesthouseRequestCommandHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<CreateGuesthouseRequestCommand, int>
{
    public async Task<int> Handle(CreateGuesthouseRequestCommand request, CancellationToken cancellationToken)
    {
        var guesthouse = await context.WelfareGuesthouses
            .Include(g => g.Service)
            .FirstOrDefaultAsync(g => g.Id == request.Input.GuesthouseId, cancellationToken);
        Guard.Against.NotFound(request.Input.GuesthouseId, guesthouse);

        if (!guesthouse.IsActive || guesthouse.Service?.IsAccessible != true)
            throw Fail.With(nameof(request.Input.GuesthouseId), "این مهمانسرا در حال حاضر فعال نیست.");

        var entity = GuesthouseRequestFactory.Build(
            request.Input,
            user.Id ?? throw Fail.With("UserId", "حساب کاربری نامعتبر است."),
            byAdmin: false);

        context.GuesthouseRequests.Add(entity);
        await context.SaveChangesAsync(cancellationToken);
        return entity.Id;
    }
}

// ── admin submits on somebody's behalf ──────────────────────────────────────

/// <summary>
/// The admin's own intake, for a person the membership database has never heard of.
/// </summary>
/// <remarks>
/// Takes every field verbatim and looks nothing up. The national-code lookup is a convenience on the
/// FORM, not a gate here: a request for somebody with no record must save exactly as easily as one
/// for a member. UserId stays null, so the row can never appear in anybody's "my requests" list —
/// the SMS link is that person's only door.
/// </remarks>
[Authorize(Roles = Roles.AdminOrSuper)]
public record CreateGuesthouseRequestAdminCommand(GuesthouseRequestInput Input)
    : IRequest<int>, ISensitivePayloadRequest;

public class CreateGuesthouseRequestAdminCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateGuesthouseRequestAdminCommand, int>
{
    public async Task<int> Handle(
        CreateGuesthouseRequestAdminCommand request, CancellationToken cancellationToken)
    {
        var guesthouse = await context.WelfareGuesthouses
            .FirstOrDefaultAsync(g => g.Id == request.Input.GuesthouseId, cancellationToken);
        Guard.Against.NotFound(request.Input.GuesthouseId, guesthouse);

        var entity = GuesthouseRequestFactory.Build(request.Input, userId: null, byAdmin: true);

        context.GuesthouseRequests.Add(entity);
        await context.SaveChangesAsync(cancellationToken);
        return entity.Id;
    }
}

// ── member: my requests ─────────────────────────────────────────────────────

[Authorize]
public record GetMyGuesthouseRequestsQuery : IRequest<IReadOnlyList<GuesthouseRequestDto>>;

public class GetMyGuesthouseRequestsQueryHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<GetMyGuesthouseRequestsQuery, IReadOnlyList<GuesthouseRequestDto>>
{
    public async Task<IReadOnlyList<GuesthouseRequestDto>> Handle(
        GetMyGuesthouseRequestsQuery request, CancellationToken cancellationToken)
    {
        // Never drop the ?? string.Empty. EF translates Where(r => r.UserId == userId) to
        // UserId = '' when userId is empty, and SQL's three-valued logic never matches NULL.
        // Admin-created requests for non-members have UserId == null and carry a live
        // PaymentToken; if userId were null here EF would emit UserId IS NULL instead, and
        // every non-member's payment token would leak to any caller of this query.
        var userId = user.Id ?? string.Empty;

        var rows = await context.GuesthouseRequests
            .AsNoTracking()
            .Include(r => r.Guesthouse)
            .Include(r => r.Companions)
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.CheckInDate)
            .ToListAsync(cancellationToken);

        return rows.Select(GuesthouseProjection.ToDto).ToList();
    }
}
