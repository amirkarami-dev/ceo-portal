using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Vms;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Vms;

/// <summary>Everything an administrator sets on a camera. Shared by create and update.</summary>
/// <remarks>
/// <see cref="Camera.StreamKey"/> is deliberately absent: it is generated on create and then never
/// changes, because it is the name go2rtc's config and every open browser tab already know.
/// </remarks>
public sealed record CameraInput(
    string Name,
    /// <summary>A code from <c>VmsCities</c>. Classification and filtering — never a permission.</summary>
    string CityCode,
    string Host,
    int RtspPort,
    /// <summary>Names a credential held on the media VPS. Never a password.</summary>
    string CredentialKey,
    /// <summary>The <c>idc</c> of the RTSP path.</summary>
    int Channel,
    /// <summary>The <c>ids</c> of the substream — the only stream the grid shows.</summary>
    int SubStreamId,
    /// <summary>The <c>ids</c> of the main stream, or null when the site's uplink cannot carry it.</summary>
    int? MainStreamId,
    bool IsActive,
    string? Notes);

public class CameraInputValidator : AbstractValidator<CameraInput>
{
    public CameraInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("نام دوربین الزامی است").MaximumLength(200);
        RuleFor(x => x.Notes).MaximumLength(1000);

        RuleFor(x => x.CityCode).NotEmpty().WithMessage("شهر را انتخاب کنید");

        RuleFor(x => x.Host)
            .NotEmpty().WithMessage("آدرس دوربین الزامی است")
            .Must(CameraRules.IsValidHost)
            .WithMessage("آدرس دوربین معتبر نیست. فقط نشانی یا نام میزبان، بدون http:// و بدون پورت");

        RuleFor(x => x.RtspPort)
            .InclusiveBetween(CameraRules.MinPort, CameraRules.MaxPort)
            .WithMessage($"پورت باید بین {CameraRules.MinPort} تا {CameraRules.MaxPort} باشد");

        RuleFor(x => x.CredentialKey)
            .NotEmpty().WithMessage("کلید اعتبارنامه الزامی است")
            .Must(CameraRules.IsValidSlug)
            .WithMessage("کلید اعتبارنامه فقط می‌تواند حروف کوچک انگلیسی، رقم و خط تیره داشته باشد");

        RuleFor(x => x.Channel).GreaterThanOrEqualTo(1).WithMessage("شمارهٔ کانال باید ۱ یا بیشتر باشد");

        RuleFor(x => x.SubStreamId)
            .GreaterThanOrEqualTo(1).WithMessage("شمارهٔ زیرجریان باید ۱ یا بیشتر باشد");

        RuleFor(x => x.MainStreamId)
            .GreaterThanOrEqualTo(1).When(x => x.MainStreamId.HasValue)
            .WithMessage("شمارهٔ جریان اصلی باید ۱ یا بیشتر باشد");

        // Same rule as CK_VmsCameras_StreamsDiffer. Here it becomes a sentence instead of a
        // constraint name: if the two were the same, opening one camera full-screen would start a
        // second session against a link that has room for one, and the picture would simply stop.
        RuleFor(x => x.MainStreamId)
            .Must((input, main) => main != input.SubStreamId)
            .When(x => x.MainStreamId.HasValue)
            .WithMessage("جریان اصلی و زیرجریان نمی‌توانند یکی باشند");
    }
}

/// <summary>Applies an input onto an entity. Used by create and update.</summary>
internal static class CameraMapper
{
    public static void Apply(Camera camera, CameraInput input)
    {
        camera.Name = input.Name.Trim();
        camera.CityCode = input.CityCode.Trim();
        camera.Host = input.Host.Trim();
        camera.RtspPort = input.RtspPort;
        camera.CredentialKey = input.CredentialKey.Trim().ToLowerInvariant();
        camera.Channel = input.Channel;
        camera.SubStreamId = input.SubStreamId;
        camera.MainStreamId = input.MainStreamId;
        camera.IsActive = input.IsActive;
        camera.Notes = string.IsNullOrWhiteSpace(input.Notes) ? null : input.Notes.Trim();
    }
}

/// <summary>
/// The checks that need the database, shared by create and update so both refuse the same things.
/// </summary>
internal static class CameraChecks
{
    /// <summary>The city must exist and be one the admin can still choose.</summary>
    /// <remarks>
    /// The foreign key would refuse an unknown code anyway, but as a <c>DbUpdateException</c> carrying
    /// a constraint name. This turns it into a sentence, and it also catches a city that exists but has
    /// been switched off — which the database has no opinion about.
    /// </remarks>
    public static async Task EnsureCityAsync(
        IApplicationDbContext context, string cityCode, CancellationToken cancellationToken)
    {
        var code = (cityCode ?? string.Empty).Trim();

        var city = await context.VmsCities
            .FirstOrDefaultAsync(x => x.Code == code, cancellationToken);

        if (city is null)
        {
            throw CameraRules.Invalid(nameof(CameraInput.CityCode), "این شهر در فهرست شهرها نیست");
        }

        if (!city.IsActive)
        {
            throw CameraRules.Invalid(nameof(CameraInput.CityCode), "این شهر غیرفعال است");
        }
    }

    /// <summary>
    /// Refuses a second camera row pointing at the same physical stream.
    /// </summary>
    /// <remarks>
    /// This is the measured constraint made into a rule. A camera site uploads about 0.41 Mbit/s and
    /// its substream needs ~0.35, so there is room for exactly one puller. Two rows on the same
    /// host/port/channel would have go2rtc open two sessions and starve both — and the symptom is the
    /// camera appearing to drop out, which reads as a fault at the site rather than a duplicate row.
    /// </remarks>
    public static async Task EnsureNotDuplicateAsync(
        IApplicationDbContext context,
        CameraInput input,
        int? exceptId,
        CancellationToken cancellationToken)
    {
        var host = input.Host.Trim();

        var clash = await context.VmsCameras.AnyAsync(
            x => !x.IsDeleted
                 && x.Host == host
                 && x.RtspPort == input.RtspPort
                 && x.Channel == input.Channel
                 && (exceptId == null || x.Id != exceptId),
            cancellationToken);

        if (clash)
        {
            throw CameraRules.Invalid(
                nameof(CameraInput.Host),
                "دوربین دیگری با همین آدرس، پورت و کانال ثبت شده است");
        }
    }
}

// ── create ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record CreateCameraCommand(CameraInput Input) : IRequest<int>;

public class CreateCameraCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateCameraCommand, int>
{
    public async Task<int> Handle(CreateCameraCommand request, CancellationToken cancellationToken)
    {
        await CameraChecks.EnsureCityAsync(context, request.Input.CityCode, cancellationToken);
        await CameraChecks.EnsureNotDuplicateAsync(context, request.Input, null, cancellationToken);

        // Deleted rows count. Their keys are held on purpose so a key is never reused — see
        // CameraRules.NextStreamKey.
        var taken = await context.VmsCameras
            .Select(x => x.StreamKey)
            .ToListAsync(cancellationToken);

        var camera = new Camera
        {
            Name = request.Input.Name,
            CityCode = request.Input.CityCode,
            Host = request.Input.Host,
            StreamKey = CameraRules.NextStreamKey(request.Input.CityCode, taken),
        };

        CameraMapper.Apply(camera, request.Input);

        context.VmsCameras.Add(camera);
        await context.SaveChangesAsync(cancellationToken);

        return camera.Id;
    }
}

public class CreateCameraCommandValidator : AbstractValidator<CreateCameraCommand>
{
    /// <summary>
    /// The empty name is what keeps the error keys flat — <c>host</c>, not <c>input.host</c>.
    /// </summary>
    /// <remarks>
    /// The request body IS the <see cref="CameraInput"/>; the command wrapper is a server-side detail.
    /// A key that leaked the wrapper would match no field in the form, so the admin panel would show a
    /// validation error with nothing highlighted. The room service shipped exactly that bug — see
    /// GOTCHAS — and it is pinned here by <c>CameraValidationKeyTests</c>.
    /// </remarks>
    public CreateCameraCommandValidator() =>
        RuleFor(x => x.Input).SetValidator(new CameraInputValidator()).OverridePropertyName(string.Empty);
}

// ── update ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record UpdateCameraCommand(int Id, CameraInput Input) : IRequest;

public class UpdateCameraCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateCameraCommand>
{
    public async Task Handle(UpdateCameraCommand request, CancellationToken cancellationToken)
    {
        var camera = await context.VmsCameras
            .FirstOrDefaultAsync(x => x.Id == request.Id && !x.IsDeleted, cancellationToken);

        Guard.Against.NotFound(request.Id, camera);

        await CameraChecks.EnsureCityAsync(context, request.Input.CityCode, cancellationToken);
        await CameraChecks.EnsureNotDuplicateAsync(context, request.Input, camera.Id, cancellationToken);

        // StreamKey is not touched, even when the city changes. It is an identifier, not a label:
        // go2rtc's config and every open tab already use it, so a camera moved from بانه to مریوان
        // keeps the key baneh-01 and that is correct.
        CameraMapper.Apply(camera, request.Input);

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateCameraCommandValidator : AbstractValidator<UpdateCameraCommand>
{
    /// <summary>Flat error keys, for the reason on <see cref="CreateCameraCommandValidator"/>.</summary>
    public UpdateCameraCommandValidator() =>
        RuleFor(x => x.Input).SetValidator(new CameraInputValidator()).OverridePropertyName(string.Empty);
}

// ── switch off / delete ──────────────────────────────────────────────────────

[Authorize(Roles = Roles.Administrator)]
public record SetCameraActiveCommand(int Id, bool IsActive) : IRequest;

public class SetCameraActiveCommandHandler(IApplicationDbContext context)
    : IRequestHandler<SetCameraActiveCommand>
{
    public async Task Handle(SetCameraActiveCommand request, CancellationToken cancellationToken)
    {
        var camera = await context.VmsCameras
            .FirstOrDefaultAsync(x => x.Id == request.Id && !x.IsDeleted, cancellationToken);

        Guard.Against.NotFound(request.Id, camera);

        camera.IsActive = request.IsActive;
        await context.SaveChangesAsync(cancellationToken);
    }
}

[Authorize(Roles = Roles.Administrator)]
public record DeleteCameraCommand(int Id) : IRequest;

public class DeleteCameraCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteCameraCommand>
{
    public async Task Handle(DeleteCameraCommand request, CancellationToken cancellationToken)
    {
        var camera = await context.VmsCameras
            .FirstOrDefaultAsync(x => x.Id == request.Id && !x.IsDeleted, cancellationToken);

        Guard.Against.NotFound(request.Id, camera);

        // Soft delete, so the stream key is never reused. A recycled key would let a stale go2rtc
        // entry, or a browser tab somebody left open, show a different camera than the one it names.
        camera.IsDeleted = true;
        camera.IsActive = false;

        await context.SaveChangesAsync(cancellationToken);
    }
}
