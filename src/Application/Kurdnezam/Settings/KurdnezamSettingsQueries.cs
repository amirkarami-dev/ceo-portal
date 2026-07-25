using System.Text.Json;
using Mabhas19.Application.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.Settings;

/// <summary>
/// The site's settings, footer links, and live visit counters in one call.
/// </summary>
public record GetKurdnezamSettingsQuery : IRequest<KurdnezamSettingsDto>;

public class GetKurdnezamSettingsQueryHandler(IApplicationDbContext context, TimeProvider clock)
    : IRequestHandler<GetKurdnezamSettingsQuery, KurdnezamSettingsDto>
{
    /// <summary>A session counts as "online" if it recorded a view this recently.</summary>
    internal static readonly TimeSpan OnlineWindow = TimeSpan.FromMinutes(5);

    public async Task<KurdnezamSettingsDto> Handle(GetKurdnezamSettingsQuery request, CancellationToken cancellationToken)
    {
        var settings = await context.KurdnezamSettings
            .AsNoTracking()
            .OrderBy(s => s.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var footerLinks = await context.KurdnezamFooterLinks
            .AsNoTracking()
            .OrderBy(l => l.SortOrder).ThenBy(l => l.Id)
            .Select(l => new KurdnezamFooterLinkItemDto(l.Title, l.Href))
            .ToListAsync(cancellationToken);

        var now = clock.GetUtcNow();
        var since = now - OnlineWindow;
        var todayStart = new DateTimeOffset(now.UtcDateTime.Date, TimeSpan.Zero);

        var total = await context.KurdnezamVisits.CountAsync(cancellationToken);
        var today = await context.KurdnezamVisits.CountAsync(v => v.VisitedAt >= todayStart, cancellationToken);
        var online = await context.KurdnezamVisits
            .Where(v => v.VisitedAt >= since)
            .Select(v => v.SessionId)
            .Distinct()
            .CountAsync(cancellationToken);

        return new KurdnezamSettingsDto
        {
            NameFa = settings?.NameFa ?? string.Empty,
            NameKu = settings?.NameKu ?? string.Empty,
            NameEn = settings?.NameEn ?? string.Empty,
            Tagline = settings?.Tagline ?? string.Empty,
            Address = settings?.Address ?? string.Empty,
            Phones = ParsePhones(settings?.PhonesJson),
            PostalCode = settings?.PostalCode ?? string.Empty,
            Telegram = settings?.Telegram ?? string.Empty,
            Instagram = settings?.Instagram ?? string.Empty,
            FooterLinks = footerLinks,
            Stats = new KurdnezamStatsDto
            {
                TotalVisits = total,
                TodayVisits = today,
                Online = online
            }
        };
    }

    private static List<string> ParsePhones(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return [];

        try
        {
            return JsonSerializer.Deserialize<List<string>>(json) ?? [];
        }
        catch (JsonException)
        {
            // Hand-edited rows shouldn't take the whole site's footer down.
            return [];
        }
    }
}
