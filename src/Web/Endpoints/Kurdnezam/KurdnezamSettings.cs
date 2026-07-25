using Mabhas19.Application.Kurdnezam.Settings;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>Site settings for the kurdnezam landing site. Read is public; update is admin-only.</summary>
public class KurdnezamSettings : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/kurdnezam/settings";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetKurdnezamSettings, string.Empty).AllowAnonymous();
        groupBuilder.MapPut(UpdateKurdnezamSettings, string.Empty).RequireAdmin();
    }

    public static async Task<Ok<KurdnezamSettingsDto>> GetKurdnezamSettings(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamSettingsQuery()));

    public static async Task<NoContent> UpdateKurdnezamSettings(ISender sender, KurdnezamSettingsInput body)
    {
        await sender.Send(new UpdateKurdnezamSettingsCommand(body));
        return TypedResults.NoContent();
    }
}
