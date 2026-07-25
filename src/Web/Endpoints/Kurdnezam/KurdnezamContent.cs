using Mabhas19.Application.Kurdnezam.Content;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>
/// The landing site's entire content in one public call — the API-backed replacement for the
/// site's bundled <c>content.ts</c>.
/// </summary>
public class KurdnezamContent : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/kurdnezam/content";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetKurdnezamContent, string.Empty).AllowAnonymous();
    }

    public static async Task<Ok<KurdnezamContentDto>> GetKurdnezamContent(ISender sender, int newsLimit = 100)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamContentQuery(newsLimit)));
}
