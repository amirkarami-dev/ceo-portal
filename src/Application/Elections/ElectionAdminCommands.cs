using Ardalis.GuardClauses;
using Mabhas19.Application.Common;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Elections;
using Microsoft.EntityFrameworkCore;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Elections;

/// <summary>One discipline allowed to vote. <c>Code</c> is opaque — see the entity's remarks.</summary>
public sealed record EligibleReshteInput(string Code, string? Label);

/// <summary>A candidate as the admin enters them. نام، توضیحات، رشته، مقطع تحصیلی.</summary>
public sealed record CandidateInput(
    string FullName,
    string? Description,
    string? ReshteCode,
    string? EducationLevel,
    /// <summary>Stored media path for the voting card. Optional — the card falls back to initials.</summary>
    string? Image,
    int SortOrder);

/// <summary>
/// Everything an admin sets on an election. Shared by create and update.
/// </summary>
/// <remarks>
/// <see cref="Title"/> is free text and restricts nobody — only <see cref="EligibleReshtes"/> does.
/// «انتخاب هیئت رئیسه واحد گاز» limits voters to مکانیک because the admin also selected code 4, not
/// because of the words in the title.
/// </remarks>
public sealed record ElectionInput(
    string Title,
    string? Description,
    ElectionEligibility EligibilityMode,
    string DateJalali,
    TimeOnly StartTime,
    TimeOnly EndTime,
    int MaxSelections,
    IReadOnlyList<EligibleReshteInput> EligibleReshtes,
    IReadOnlyList<CandidateInput> Candidates);

// ── shared validation ────────────────────────────────────────────────────────

public class ElectionInputValidator : AbstractValidator<ElectionInput>
{
    public ElectionInputValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Description).MaximumLength(2000);

        RuleFor(x => x.DateJalali)
            .NotEmpty()
            .Must(d => JalaliDate.Parse(d) is not null)
            .WithMessage("تاریخ برگزاری معتبر نیست. نمونهٔ درست: 1405/05/01");

        // A zero-length window is not a window. The DB also refuses it (CK_Elections_Window), but
        // catching it here gives the admin a Persian message instead of a 500.
        RuleFor(x => x)
            .Must(x => x.EndTime > x.StartTime)
            .WithMessage("ساعت پایان باید بعد از ساعت شروع باشد")
            .WithName(nameof(ElectionInput.EndTime));

        RuleFor(x => x.MaxSelections)
            .GreaterThanOrEqualTo(1)
            .WithMessage("حداقل یک کاندیدا باید قابل انتخاب باشد");

        // An election with nobody to vote for is the most likely admin mistake, and it would
        // otherwise publish silently and waste the whole window.
        RuleFor(x => x.Candidates)
            .NotEmpty()
            .WithMessage("حداقل یک کاندیدا لازم است");

        // Picking 3 of 2 candidates cannot be satisfied.
        RuleFor(x => x)
            .Must(x => x.Candidates.Count == 0 || x.MaxSelections <= x.Candidates.Count)
            .WithMessage("تعداد انتخاب مجاز نمی‌تواند از تعداد کاندیداها بیشتر باشد")
            .WithName(nameof(ElectionInput.MaxSelections));

        // ByReshte with an empty list would silently mean "nobody may vote".
        RuleFor(x => x.EligibleReshtes)
            .NotEmpty()
            .When(x => x.EligibilityMode == ElectionEligibility.ByReshte)
            .WithMessage("برای انتخابات رشته‌محور، حداقل یک رشته باید انتخاب شود");

        RuleForEach(x => x.EligibleReshtes).ChildRules(r =>
            r.RuleFor(x => x.Code).NotEmpty().MaximumLength(50));

        RuleForEach(x => x.Candidates).ChildRules(r =>
        {
            r.RuleFor(x => x.FullName).NotEmpty().MaximumLength(300);
            r.RuleFor(x => x.Description).MaximumLength(2000);
            r.RuleFor(x => x.ReshteCode).MaximumLength(50);
            r.RuleFor(x => x.EducationLevel).MaximumLength(200);
            r.RuleFor(x => x.Image).MaximumLength(500);
        });
    }
}

/// <summary>Applies an <see cref="ElectionInput"/> onto an entity. Used by create and update.</summary>
internal static class ElectionMapper
{
    public static void Apply(Election e, ElectionInput i)
    {
        // Parse() has already been validated, but never use `!` on user input — a validator can be
        // bypassed by a future caller that forgets to run the pipeline.
        var date = JalaliDate.Parse(i.DateJalali)
                   ?? throw ElectionGuard.Invalid(
                       nameof(ElectionInput.DateJalali), "تاریخ برگزاری معتبر نیست");

        e.Title = i.Title.Trim();
        e.Description = i.Description?.Trim();
        e.EligibilityMode = i.EligibilityMode;
        e.DateJalali = JalaliDate.NormalizeDigits(i.DateJalali);
        e.Date = date;
        e.StartTime = i.StartTime;
        e.EndTime = i.EndTime;
        e.MaxSelections = i.MaxSelections;

        // Resolve the local date+time to absolute instants ONCE, here. Every later comparison uses
        // these, so a voting window never depends on the server's own time zone.
        e.OpensAtUtc = IranTime.ToInstant(date, i.StartTime);
        e.ClosesAtUtc = IranTime.ToInstant(date, i.EndTime);

        e.EligibleReshtes.Clear();
        if (i.EligibilityMode == ElectionEligibility.ByReshte)
        {
            // Distinct on the normalised code: the composite PK would otherwise throw on a duplicate,
            // and "4" typed twice is an admin slip, not an error worth a 500.
            foreach (var r in i.EligibleReshtes
                         .Select(r => new { Code = JalaliDate.NormalizeDigits(r.Code), r.Label })
                         .GroupBy(r => r.Code, StringComparer.OrdinalIgnoreCase)
                         .Select(g => g.First()))
            {
                e.EligibleReshtes.Add(new ElectionEligibleReshte
                {
                    ReshteCode = r.Code,
                    ReshteLabel = r.Label?.Trim()
                });
            }
        }

        e.Candidates.Clear();
        var order = 0;
        foreach (var c in i.Candidates)
        {
            e.Candidates.Add(new ElectionCandidate
            {
                FullName = c.FullName.Trim(),
                Description = c.Description?.Trim(),
                ReshteCode = string.IsNullOrWhiteSpace(c.ReshteCode)
                    ? null
                    : JalaliDate.NormalizeDigits(c.ReshteCode),
                EducationLevel = c.EducationLevel?.Trim(),
                Image = string.IsNullOrWhiteSpace(c.Image) ? null : c.Image.Trim(),
                SortOrder = c.SortOrder == 0 ? order : c.SortOrder
            });
            order++;
        }
    }
}

// ── create ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record CreateElectionCommand(ElectionInput Input) : IRequest<int>;

public class CreateElectionCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateElectionCommand, int>
{
    public async Task<int> Handle(CreateElectionCommand request, CancellationToken cancellationToken)
    {
        var entity = new Election { Status = ElectionStatus.Draft };
        ElectionMapper.Apply(entity, request.Input);

        context.Elections.Add(entity);
        await context.SaveChangesAsync(cancellationToken);

        return entity.Id;
    }
}

public class CreateElectionCommandValidator : AbstractValidator<CreateElectionCommand>
{
    public CreateElectionCommandValidator()
        => RuleFor(x => x.Input).SetValidator(new ElectionInputValidator());
}

// ── update ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record UpdateElectionCommand(int Id, ElectionInput Input) : IRequest;

public class UpdateElectionCommandHandler(IApplicationDbContext context, TimeProvider clock)
    : IRequestHandler<UpdateElectionCommand>
{
    public async Task Handle(UpdateElectionCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.Elections
            .Include(e => e.Candidates)
            .Include(e => e.EligibleReshtes)
            .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);
        await ElectionGuard.EnsureEditableAsync(context, entity, clock, cancellationToken);

        ElectionMapper.Apply(entity, request.Input);
        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateElectionCommandValidator : AbstractValidator<UpdateElectionCommand>
{
    public UpdateElectionCommandValidator()
        => RuleFor(x => x.Input).SetValidator(new ElectionInputValidator());
}

// ── publish / cancel / delete ────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record PublishElectionCommand(int Id) : IRequest;

public class PublishElectionCommandHandler(IApplicationDbContext context, TimeProvider clock)
    : IRequestHandler<PublishElectionCommand>
{
    public async Task Handle(PublishElectionCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.Elections
            .Include(e => e.Candidates)
            .Include(e => e.EligibleReshtes)
            .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        if (entity.Status != ElectionStatus.Draft)
        {
            throw ElectionGuard.Invalid(nameof(entity.Status), "فقط انتخابات پیش‌نویس قابل انتشار است");
        }

        // Re-check the shape at publish, not only at save. A draft can be saved incomplete and then
        // published later, and publishing is the point of no return.
        if (entity.Candidates.Count == 0)
        {
            throw ElectionGuard.Invalid(nameof(entity.Candidates), "حداقل یک کاندیدا لازم است");
        }

        if (entity.MaxSelections > entity.Candidates.Count)
        {
            throw ElectionGuard.Invalid(
                nameof(entity.MaxSelections),
                "تعداد انتخاب مجاز نمی‌تواند از تعداد کاندیداها بیشتر باشد");
        }

        if (entity.EligibilityMode == ElectionEligibility.ByReshte && entity.EligibleReshtes.Count == 0)
        {
            throw ElectionGuard.Invalid(
                nameof(entity.EligibleReshtes),
                "برای انتخابات رشته‌محور، حداقل یک رشته باید انتخاب شود");
        }

        // Publishing something already finished is almost certainly a mistake, and it would appear to
        // voters as an election they can never take part in.
        if (entity.ClosesAtUtc <= clock.GetUtcNow())
        {
            throw ElectionGuard.Invalid(
                nameof(entity.ClosesAtUtc),
                "زمان پایان این انتخابات گذشته است");
        }

        entity.Status = ElectionStatus.Published;
        await context.SaveChangesAsync(cancellationToken);
    }
}

[Authorize(Roles = Roles.AdminOrSuper)]
public record CancelElectionCommand(int Id) : IRequest;

public class CancelElectionCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CancelElectionCommand>
{
    public async Task Handle(CancelElectionCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.Elections
            .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        // Cancelling stays allowed after voting opens — it is the documented way to abandon an
        // election. Ballots are left alone: they are meaningless without a published election, and
        // deleting them here would be a way to erase evidence.
        entity.Status = ElectionStatus.Cancelled;
        await context.SaveChangesAsync(cancellationToken);
    }
}

[Authorize(Roles = Roles.AdminOrSuper)]
public record DeleteElectionCommand(int Id) : IRequest;

public class DeleteElectionCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteElectionCommand>
{
    public async Task Handle(DeleteElectionCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.Elections
            .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, entity);

        // Only a draft can be deleted. Anything published may already have ballots, and there is no
        // FK to stop the delete — the receipts and ballots deliberately have none — so this check IS
        // the protection. Removing it would let an admin erase a running election and its votes.
        if (entity.Status != ElectionStatus.Draft)
        {
            throw ElectionGuard.Invalid(
                nameof(entity.Status),
                "فقط انتخابات پیش‌نویس قابل حذف است. برای لغو، از گزینهٔ لغو استفاده کنید");
        }

        await ElectionGuard.EnsureNoBallotsAsync(context, entity.Id, cancellationToken);

        context.Elections.Remove(entity);
        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── the freeze rule ──────────────────────────────────────────────────────────

/// <summary>
/// The rule that stops a running election being reshaped underneath its voters.
/// </summary>
/// <remarks>
/// The adversarial review found editable candidate fields to be a way to rig a live election, so this
/// is enforced in one place rather than remembered at each call site.
/// </remarks>
internal static class ElectionGuard
{
    public static ValidationException Invalid(string field, string message)
    {
        var ex = new ValidationException();
        ex.Errors[field] = [message];
        return ex;
    }

    /// <summary>Throws unless the election may still be edited.</summary>
    public static async Task EnsureEditableAsync(
        IApplicationDbContext context,
        Election election,
        TimeProvider clock,
        CancellationToken ct)
    {
        if (election.Status == ElectionStatus.Cancelled)
        {
            throw Invalid(nameof(election.Status), "این انتخابات لغو شده است و قابل ویرایش نیست");
        }

        var now = clock.GetUtcNow();

        if (election.Status == ElectionStatus.Published && now >= election.OpensAtUtc)
        {
            throw Invalid(
                nameof(election.OpensAtUtc),
                "رأی‌گیری آغاز شده است و این انتخابات قابل ویرایش نیست");
        }

        // Belt and braces: a ballot before OpensAtUtc could only happen through a bug, but if it has
        // happened, editing is still the wrong thing to allow.
        await EnsureNoBallotsAsync(context, election.Id, ct);
    }

    public static async Task EnsureNoBallotsAsync(
        IApplicationDbContext context,
        int electionId,
        CancellationToken ct)
    {
        if (await context.ElectionBallots.AnyAsync(b => b.ElectionId == electionId, ct))
        {
            throw Invalid("Ballots", "برای این انتخابات رأی ثبت شده است و تغییر آن مجاز نیست");
        }
    }
}
