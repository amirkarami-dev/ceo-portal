using Ardalis.GuardClauses;
using Mabhas19.Application.Common;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Rooms;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Rooms;
using Microsoft.EntityFrameworkCore;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Rooms;

/// <summary>Everything an administrator sets on a meeting. Shared by create and update.</summary>
/// <remarks>
/// The start time arrives as a Jalali date plus a time-of-day, the same as an election, because that is
/// how the admin thinks about it. It is resolved to an absolute instant once, on save, so no later
/// comparison depends on the server's own time zone.
/// </remarks>
public sealed record RoomInput(
    string Name,
    string? Description,
    RoomType Type,
    RoomJoinMode JoinMode,
    /// <summary>
    /// The presenter's کد ملی. Required for a presentation, and the only identity allowed to publish.
    /// </summary>
    /// <remarks>
    /// A کد ملی and not a free-text id, because an authenticated join carries the کد ملی as its media
    /// identity. The display name is not taken from here — it is read from the organisation's record,
    /// so the name on a presentation is the real one.
    /// </remarks>
    string? PresenterUserId,
    /// <summary>Jalali, as typed: 1405/05/01.</summary>
    string DateJalali,
    TimeOnly StartTime,
    int EarlyJoinMinutes,
    int? DurationMinutes,
    int MaxParticipants);

public class RoomInputValidator : AbstractValidator<RoomInput>
{
    public RoomInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("نام جلسه الزامی است").MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(1000);

        RuleFor(x => x.DateJalali)
            .NotEmpty()
            .Must(d => JalaliDate.Parse(d) is not null)
            .WithMessage("تاریخ برگزاری معتبر نیست. نمونهٔ درست: 1405/05/01");

        RuleFor(x => x.MaxParticipants)
            .InclusiveBetween(RoomRules.MinParticipants, RoomRules.MaxParticipants)
            .WithMessage($"تعداد شرکت‌کنندگان باید بین {RoomRules.MinParticipants} تا {RoomRules.MaxParticipants} باشد");

        RuleFor(x => x.EarlyJoinMinutes)
            .InclusiveBetween(0, RoomRules.MaxEarlyJoinMinutes)
            .WithMessage($"زمان ورود زودهنگام باید بین ۰ تا {RoomRules.MaxEarlyJoinMinutes} دقیقه باشد");

        RuleFor(x => x.DurationMinutes)
            .GreaterThan(0).When(x => x.DurationMinutes.HasValue)
            .WithMessage("مدت جلسه باید بیشتر از صفر باشد");

        RuleFor(x => x.PresenterUserId).MaximumLength(64);

        // The type/join-mode combinations. Same rules as the CHECK constraints; this is where they
        // become a sentence rather than a database error.
        RuleFor(x => x)
            .Must(x => RoomRules.Validate(x.Type, x.JoinMode, x.PresenterUserId) is null)
            .WithMessage(x => RoomRules.Validate(x.Type, x.JoinMode, x.PresenterUserId)!)
            .WithName(nameof(RoomInput.JoinMode));
    }
}

/// <summary>Applies an input onto an entity. Used by create and update.</summary>
internal static class RoomMapper
{
    /// <param name="presenterName">
    /// The presenter's name as the organisation records it, already resolved. Null for a meeting.
    /// </param>
    public static void Apply(Room room, RoomInput input, string? presenterName)
    {
        var date = JalaliDate.Parse(input.DateJalali)
                   ?? throw RoomGuard.Invalid(nameof(RoomInput.DateJalali), "تاریخ برگزاری معتبر نیست");

        room.Name = input.Name.Trim();
        room.Description = input.Description?.Trim();
        room.Type = input.Type;
        room.JoinMode = input.JoinMode;
        room.MaxParticipants = input.MaxParticipants;
        room.EarlyJoinMinutes = input.EarlyJoinMinutes;
        room.DurationMinutes = input.DurationMinutes;

        // Resolved once, here. Every later comparison uses the instant, so a meeting window never
        // depends on which machine is asking.
        room.StartsAtUtc = IranTime.ToInstant(date, input.StartTime);

        // Only a presentation has a presenter. Clearing it on the way to a meeting stops a stale name
        // showing on a join page after somebody switched the type.
        //
        // The id is the کد ملی, normalised. That is not a preference: an authenticated join carries the
        // کد ملی as its media identity, and MayPublish compares the two with StringComparison.Ordinal.
        // Anything else here is a presenter who joins their own presentation muted, with no error
        // anywhere — which is why the format is checked and the person is looked up before saving.
        room.PresenterUserId = input.Type == RoomType.Presentation
            ? JalaliDate.NormalizeDigits(input.PresenterUserId ?? string.Empty).Trim()
            : null;
        room.PresenterName = input.Type == RoomType.Presentation ? presenterName : null;

        // The link and the join mode move together — the database enforces it, so drifting here would
        // be a save that fails with a constraint name instead of a message.
        if (RoomRules.NeedsJoinToken(input.JoinMode))
        {
            room.JoinToken ??= RoomRules.NewJoinToken();
        }
        else
        {
            room.JoinToken = null;
        }
    }
}

/// <summary>
/// Turns a کد ملی into the name the organisation has on file.
/// </summary>
/// <remarks>
/// Shared by the invite list and the presenter, because both identify a person the same way and both
/// must fail the same way. The three outcomes are deliberately three different messages: an outage
/// must never read as "this person does not exist" — the trap the election work recorded in GOTCHAS.
/// </remarks>
internal static class RoomPeople
{
    public static async Task<string?> ResolveNameAsync(
        IEngineerDirectory directory,
        string nationalCode,
        string field,
        CancellationToken cancellationToken)
    {
        var code = JalaliDate.NormalizeDigits(nationalCode ?? string.Empty).Trim();

        if (code.Length != 10 || !code.All(char.IsAsciiDigit))
        {
            throw RoomGuard.Invalid(field, "کد ملی باید ۱۰ رقم باشد");
        }

        var lookup = await directory.LookupAsync(code, cancellationToken);

        if (lookup.Outcome == DirectoryOutcome.Unavailable)
        {
            throw RoomGuard.Invalid(
                field, "ارتباط با سامانه نظام مهندسی برقرار نشد. لطفاً چند لحظه بعد دوباره تلاش کنید");
        }

        if (lookup.Engineer is null)
        {
            throw RoomGuard.Invalid(field, "این کد ملی در سامانه نظام مهندسی یافت نشد");
        }

        return lookup.Engineer.FullName;
    }

    /// <summary>The presenter's name, or null when this is a meeting and there is no presenter.</summary>
    public static Task<string?> ResolvePresenterAsync(
        IEngineerDirectory directory,
        RoomInput input,
        CancellationToken cancellationToken)
        => input.Type == RoomType.Presentation
            ? ResolveNameAsync(
                directory,
                input.PresenterUserId ?? string.Empty,
                nameof(RoomInput.PresenterUserId),
                cancellationToken)
            : Task.FromResult<string?>(null);
}

// ── create ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record CreateRoomCommand(RoomInput Input) : IRequest<int>;

public class CreateRoomCommandHandler(IApplicationDbContext context, IEngineerDirectory directory)
    : IRequestHandler<CreateRoomCommand, int>
{
    public async Task<int> Handle(CreateRoomCommand request, CancellationToken cancellationToken)
    {
        var presenterName = await RoomPeople.ResolvePresenterAsync(
            directory, request.Input, cancellationToken);

        var room = new Room
        {
            Name = request.Input.Name,
            Slug = RoomRules.NewSlug(),
            IsActive = true,
        };

        RoomMapper.Apply(room, request.Input, presenterName);

        context.Rooms.Add(room);
        await context.SaveChangesAsync(cancellationToken);

        return room.Id;
    }
}

public class CreateRoomCommandValidator : AbstractValidator<CreateRoomCommand>
{
    /// <summary>
    /// The empty name is what keeps the error keys flat — <c>joinMode</c>, not <c>input.joinMode</c>.
    /// </summary>
    /// <remarks>
    /// The request body IS the <see cref="RoomInput"/>; the command wrapper is a server-side detail. A
    /// key that leaked the wrapper would not match any field in the form, so the admin panel would show
    /// a validation error with nothing highlighted. Pinned by <c>RoomValidationKeyTests</c>.
    /// </remarks>
    public CreateRoomCommandValidator() =>
        RuleFor(x => x.Input).SetValidator(new RoomInputValidator()).OverridePropertyName(string.Empty);
}

// ── update ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record UpdateRoomCommand(int Id, RoomInput Input) : IRequest;

public class UpdateRoomCommandHandler(IApplicationDbContext context, IEngineerDirectory directory)
    : IRequestHandler<UpdateRoomCommand>
{
    public async Task Handle(UpdateRoomCommand request, CancellationToken cancellationToken)
    {
        var room = await context.Rooms
            .Include(x => x.Invites)
            .FirstOrDefaultAsync(x => x.Id == request.Id && !x.IsDeleted, cancellationToken);

        Guard.Against.NotFound(request.Id, room);

        var presenterName = await RoomPeople.ResolvePresenterAsync(
            directory, request.Input, cancellationToken);

        RoomMapper.Apply(room, request.Input, presenterName);

        // Invites belong to a meeting. Switching to a presentation would otherwise leave a list that
        // no longer gates anything, which reads as though it still does.
        if (!RoomRules.UsesInvites(room.JoinMode) && room.Invites.Count > 0)
        {
            context.RoomInvites.RemoveRange(room.Invites);
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateRoomCommandValidator : AbstractValidator<UpdateRoomCommand>
{
    /// <summary>Flat error keys, for the reason on <see cref="CreateRoomCommandValidator"/>.</summary>
    public UpdateRoomCommandValidator() =>
        RuleFor(x => x.Input).SetValidator(new RoomInputValidator()).OverridePropertyName(string.Empty);
}

// ── the join link ────────────────────────────────────────────────────────────

/// <summary>Issues a new join link and kills every copy of the old one.</summary>
[Authorize(Roles = Roles.AdminOrSuper)]
public record RegenerateRoomLinkCommand(int Id) : IRequest<string>;

public class RegenerateRoomLinkCommandHandler(IApplicationDbContext context)
    : IRequestHandler<RegenerateRoomLinkCommand, string>
{
    public async Task<string> Handle(RegenerateRoomLinkCommand request, CancellationToken cancellationToken)
    {
        var room = await context.Rooms
            .FirstOrDefaultAsync(x => x.Id == request.Id && !x.IsDeleted, cancellationToken);

        Guard.Against.NotFound(request.Id, room);

        if (!RoomRules.NeedsJoinToken(room.JoinMode))
        {
            throw RoomGuard.Invalid(nameof(room.JoinMode), "این جلسه لینک ورود ندارد");
        }

        room.JoinToken = RoomRules.NewJoinToken();
        await context.SaveChangesAsync(cancellationToken);

        return room.JoinToken;
    }
}

// ── activate / delete ────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record SetRoomActiveCommand(int Id, bool IsActive) : IRequest;

public class SetRoomActiveCommandHandler(IApplicationDbContext context, ILiveKitAdmin liveKit)
    : IRequestHandler<SetRoomActiveCommand>
{
    public async Task Handle(SetRoomActiveCommand request, CancellationToken cancellationToken)
    {
        var room = await context.Rooms
            .FirstOrDefaultAsync(x => x.Id == request.Id && !x.IsDeleted, cancellationToken);

        Guard.Against.NotFound(request.Id, room);

        room.IsActive = request.IsActive;
        await context.SaveChangesAsync(cancellationToken);

        // Closing the doors also empties the room. Leaving a live meeting running after an admin
        // deactivated it would look exactly like the switch not working.
        if (!request.IsActive)
        {
            await liveKit.EndRoomAsync(room.Slug, cancellationToken);
        }
    }
}

[Authorize(Roles = Roles.AdminOrSuper)]
public record DeleteRoomCommand(int Id) : IRequest;

public class DeleteRoomCommandHandler(IApplicationDbContext context, ILiveKitAdmin liveKit)
    : IRequestHandler<DeleteRoomCommand>
{
    public async Task Handle(DeleteRoomCommand request, CancellationToken cancellationToken)
    {
        var room = await context.Rooms
            .FirstOrDefaultAsync(x => x.Id == request.Id && !x.IsDeleted, cancellationToken);

        Guard.Against.NotFound(request.Id, room);

        // Soft delete: the chat history and the invite list stay readable, and the slug is never
        // reused, so an old join link can never land in a new meeting.
        room.IsDeleted = true;
        room.IsActive = false;
        room.JoinToken = null;

        await context.SaveChangesAsync(cancellationToken);
        await liveKit.EndRoomAsync(room.Slug, cancellationToken);
    }
}

// ── invites ──────────────────────────────────────────────────────────────────

/// <summary>
/// Adds somebody to a meeting's invite list, by کد ملی.
/// </summary>
/// <remarks>
/// The code is looked up in the organisation's directory so the stored name is the real one rather
/// than whatever an admin typed, and so inviting a code that belongs to nobody fails immediately
/// instead of at the door.
/// </remarks>
[Authorize(Roles = Roles.AdminOrSuper)]
public record InviteToRoomCommand(int Id, string NationalCode) : IRequest;

public class InviteToRoomCommandHandler(
    IApplicationDbContext context,
    IEngineerDirectory directory) : IRequestHandler<InviteToRoomCommand>
{
    public async Task Handle(InviteToRoomCommand request, CancellationToken cancellationToken)
    {
        var room = await context.Rooms
            .Include(x => x.Invites)
            .FirstOrDefaultAsync(x => x.Id == request.Id && !x.IsDeleted, cancellationToken);

        Guard.Against.NotFound(request.Id, room);

        if (!RoomRules.UsesInvites(room.JoinMode))
        {
            throw RoomGuard.Invalid(
                nameof(room.JoinMode),
                "این جلسه با لینک برگزار می‌شود و فهرست دعوت ندارد");
        }

        var code = JalaliDate.NormalizeDigits(request.NationalCode ?? string.Empty).Trim();

        // Already invited is an admin slip, not an error. The unique index is what guarantees it;
        // this just avoids showing them a failure for something that is already true.
        if (room.Invites.Any(i => string.Equals(i.UserId, code, StringComparison.Ordinal)))
        {
            return;
        }

        var name = await RoomPeople.ResolveNameAsync(
            directory, code, nameof(InviteToRoomCommand.NationalCode), cancellationToken);

        context.RoomInvites.Add(new RoomInvite
        {
            RoomId = room.Id,
            UserId = code,
            UserName = name,
        });

        await context.SaveChangesAsync(cancellationToken);
    }
}

[Authorize(Roles = Roles.AdminOrSuper)]
public record RemoveRoomInviteCommand(int Id, string UserId) : IRequest;

public class RemoveRoomInviteCommandHandler(IApplicationDbContext context)
    : IRequestHandler<RemoveRoomInviteCommand>
{
    public async Task Handle(RemoveRoomInviteCommand request, CancellationToken cancellationToken)
    {
        var invite = await context.RoomInvites
            .FirstOrDefaultAsync(
                x => x.RoomId == request.Id && x.UserId == request.UserId, cancellationToken);

        // Removing an invite that is not there is the state the caller wanted.
        if (invite is null)
        {
            return;
        }

        context.RoomInvites.Remove(invite);
        await context.SaveChangesAsync(cancellationToken);
    }
}

internal static class RoomGuard
{
    public static ValidationException Invalid(string field, string message)
    {
        var ex = new ValidationException();
        ex.Errors[field] = [message];
        return ex;
    }
}
