using Mabhas19.Application.Kurdnezam.Categories;
using Mabhas19.Application.Kurdnezam.Forms;
using Mabhas19.Application.Kurdnezam.News;
using Mabhas19.Application.Kurdnezam.OrgPages;
using Mabhas19.Application.Kurdnezam.People;
using Mabhas19.Application.Kurdnezam.QuickLinks;
using Mabhas19.Application.Kurdnezam.Settings;
using Mabhas19.Application.Kurdnezam.Slides;
using Mabhas19.Application.Kurdnezam.TabGroups;
using Mabhas19.Application.Kurdnezam.Units;

namespace Mabhas19.Application.Kurdnezam.Content;

/// <summary>
/// The whole site's content in one payload.
/// </summary>
/// <remarks>
/// This mirrors the shape the landing site already consumed from its bundled <c>content.ts</c>,
/// so the site can swap the static import for a single fetch. Individual resource endpoints still
/// exist for the admin panel, which edits one collection at a time.
/// </remarks>
public sealed class KurdnezamContentDto
{
    public KurdnezamSettingsDto Settings { get; init; } = new();

    public IReadOnlyList<KurdnezamSlideDto> Slides { get; init; } = [];

    public IReadOnlyList<KurdnezamQuickLinkDto> QuickLinks { get; init; } = [];

    public IReadOnlyList<KurdnezamCategoryDto> Categories { get; init; } = [];

    public IReadOnlyList<KurdnezamNewsDto> News { get; init; } = [];

    public IReadOnlyList<KurdnezamPersonDto> People { get; init; } = [];

    public IReadOnlyList<KurdnezamUnitDto> Units { get; init; } = [];

    public IReadOnlyList<KurdnezamTabGroupDto> TabGroups { get; init; } = [];

    public IReadOnlyList<KurdnezamFormDto> Forms { get; init; } = [];

    public IReadOnlyList<KurdnezamOrgPageDto> OrgPages { get; init; } = [];
}

/// <param name="NewsLimit">
/// How many articles to inline. The site renders lists, tickers, and a category rail off this
/// payload; anything deeper pages against <c>/api/kurdnezam/news</c>.
/// </param>
public record GetKurdnezamContentQuery(int NewsLimit = 100) : IRequest<KurdnezamContentDto>;

public class GetKurdnezamContentQueryHandler(ISender sender)
    : IRequestHandler<GetKurdnezamContentQuery, KurdnezamContentDto>
{
    public async Task<KurdnezamContentDto> Handle(GetKurdnezamContentQuery request, CancellationToken cancellationToken)
    {
        var limit = Math.Clamp(request.NewsLimit, 1, 100);

        // Composed from the same queries the individual endpoints use, so there is exactly one
        // projection per collection. Sent sequentially: they share one scoped DbContext, which
        // is not thread-safe.
        var settings = await sender.Send(new GetKurdnezamSettingsQuery(), cancellationToken);
        var slides = await sender.Send(new GetKurdnezamSlidesQuery(), cancellationToken);
        var quickLinks = await sender.Send(new GetKurdnezamQuickLinksQuery(), cancellationToken);
        var categories = await sender.Send(new GetKurdnezamCategoriesQuery(), cancellationToken);
        var news = await sender.Send(new GetKurdnezamNewsQuery(Page: 1, PageSize: limit), cancellationToken);
        var people = await sender.Send(new GetKurdnezamPeopleQuery(), cancellationToken);
        var units = await sender.Send(new GetKurdnezamUnitsQuery(), cancellationToken);
        var tabGroups = await sender.Send(new GetKurdnezamTabGroupsQuery(), cancellationToken);
        var forms = await sender.Send(new GetKurdnezamFormsQuery(), cancellationToken);
        var orgPages = await sender.Send(new GetKurdnezamOrgPagesQuery(), cancellationToken);

        return new KurdnezamContentDto
        {
            Settings = settings,
            Slides = slides,
            QuickLinks = quickLinks,
            Categories = categories,
            News = news.Items,
            People = people,
            Units = units,
            TabGroups = tabGroups,
            Forms = forms,
            OrgPages = orgPages
        };
    }
}
