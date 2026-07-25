using System.Text.Json;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.Settings;

/// <summary>The editable half of site settings (counters and footer links are managed elsewhere).</summary>
public sealed record KurdnezamSettingsInput(
    string NameFa,
    string NameKu,
    string NameEn,
    string Tagline,
    string Address,
    IReadOnlyList<string> Phones,
    string PostalCode,
    string Telegram,
    string Instagram);

[Authorize(Roles = Roles.Administrator)]
public record UpdateKurdnezamSettingsCommand(KurdnezamSettingsInput Input) : IRequest;

public class UpdateKurdnezamSettingsCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateKurdnezamSettingsCommand>
{
    public async Task Handle(UpdateKurdnezamSettingsCommand request, CancellationToken cancellationToken)
    {
        // Settings are a singleton; create the row on first save rather than requiring a seed.
        var entity = await context.KurdnezamSettings
            .OrderBy(s => s.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (entity is null)
        {
            entity = new Domain.Kurdnezam.KurdnezamSettings();
            context.KurdnezamSettings.Add(entity);
        }

        var i = request.Input;

        entity.NameFa = i.NameFa;
        entity.NameKu = i.NameKu;
        entity.NameEn = i.NameEn;
        entity.Tagline = i.Tagline;
        entity.Address = i.Address;
        entity.PhonesJson = JsonSerializer.Serialize(i.Phones);
        entity.PostalCode = i.PostalCode;
        entity.Telegram = i.Telegram;
        entity.Instagram = i.Instagram;

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class UpdateKurdnezamSettingsCommandValidator : AbstractValidator<UpdateKurdnezamSettingsCommand>
{
    public UpdateKurdnezamSettingsCommandValidator()
    {
        RuleFor(x => x.Input.NameFa).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Input.NameKu).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Input.NameEn).NotEmpty().MaximumLength(300);
        RuleFor(x => x.Input.Tagline).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Input.Address).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.Input.PostalCode).NotEmpty().MaximumLength(20);
        RuleFor(x => x.Input.Telegram).NotEmpty().MaximumLength(500);
        RuleFor(x => x.Input.Instagram).NotEmpty().MaximumLength(500);

        RuleForEach(x => x.Input.Phones).NotEmpty().MaximumLength(30);
    }
}
