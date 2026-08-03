using Mabhas19.Application.Kurdnezam.ContactSections;
using Mabhas19.Domain.Constants;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>
/// Contact blocks on <c>/p/tamas</c> and the rows inside them. Reads are public; writes require the
/// Administrator role.
/// </summary>
/// <remarks>
/// Handler method names are globally unique on purpose — <c>EndpointRouteBuilderExtensions</c>
/// derives the endpoint name (and OpenAPI operationId) from the method name, and duplicate names
/// across groups break route matching for the whole API.
/// </remarks>
public class KurdnezamContactSections : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/kurdnezam/contact-sections";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetKurdnezamContactSections, string.Empty).AllowAnonymous();
        groupBuilder.MapGet(GetKurdnezamContactSectionById, "{id:int}").AllowAnonymous();

        groupBuilder.MapPost(CreateKurdnezamContactSection, string.Empty).RequireAdmin();
        groupBuilder.MapPut(UpdateKurdnezamContactSection, "{id:int}").RequireAdmin();
        groupBuilder.MapDelete(DeleteKurdnezamContactSection, "{id:int}").RequireAdmin();

        // Channels hang off their section for create, then address by their own id — the same shape
        // the tab items use, so the admin panel's master/detail code is the same on both screens.
        groupBuilder.MapPost(CreateKurdnezamContactChannel, "{id:int}/channels").RequireAdmin();
        groupBuilder.MapPut(UpdateKurdnezamContactChannel, "channels/{channelId:int}").RequireAdmin();
        groupBuilder.MapDelete(DeleteKurdnezamContactChannel, "channels/{channelId:int}").RequireAdmin();
    }

    /// <param name="includeInactive">
    /// Retired sections are for the panel only, and this route is anonymous so the flag is
    /// caller-controlled — it is therefore <b>enforced</b>, not merely documented. A retired block
    /// still holds real numbers and addresses; "we took it off the page" has to mean it is gone.
    /// </param>
    public static async Task<Ok<IReadOnlyList<KurdnezamContactSectionDto>>> GetKurdnezamContactSections(
        ISender sender, HttpContext httpContext, bool includeInactive = false)
    {
        var admin = httpContext.User.IsInRole(Roles.Administrator);
        return TypedResults.Ok(await sender.Send(new GetKurdnezamContactSectionsQuery(includeInactive && admin)));
    }

    /// <summary>
    /// A retired section is hidden from anyone but an administrator here too — otherwise the id
    /// route would hand back exactly what the list route refuses.
    /// </summary>
    public static async Task<Results<Ok<KurdnezamContactSectionDto>, NotFound>> GetKurdnezamContactSectionById(
        ISender sender, HttpContext httpContext, int id)
    {
        var section = await sender.Send(new GetKurdnezamContactSectionByIdQuery(id));
        if (!section.IsActive && !httpContext.User.IsInRole(Roles.Administrator))
        {
            return TypedResults.NotFound();
        }

        return TypedResults.Ok(section);
    }

    public static async Task<Created<int>> CreateKurdnezamContactSection(
        ISender sender, KurdnezamContactSectionInput body)
    {
        var id = await sender.Send(new CreateKurdnezamContactSectionCommand(body));
        return TypedResults.Created($"/api/kurdnezam/contact-sections/{id}", id);
    }

    public static async Task<NoContent> UpdateKurdnezamContactSection(
        ISender sender, int id, KurdnezamContactSectionInput body)
    {
        await sender.Send(new UpdateKurdnezamContactSectionCommand(id, body));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteKurdnezamContactSection(ISender sender, int id)
    {
        await sender.Send(new DeleteKurdnezamContactSectionCommand(id));
        return TypedResults.NoContent();
    }

    public static async Task<Created<int>> CreateKurdnezamContactChannel(
        ISender sender, int id, KurdnezamContactChannelInput body)
    {
        var channelId = await sender.Send(new CreateKurdnezamContactChannelCommand(id, body));
        return TypedResults.Created($"/api/kurdnezam/contact-sections/channels/{channelId}", channelId);
    }

    public static async Task<NoContent> UpdateKurdnezamContactChannel(
        ISender sender, int channelId, KurdnezamContactChannelInput body)
    {
        await sender.Send(new UpdateKurdnezamContactChannelCommand(channelId, body));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteKurdnezamContactChannel(ISender sender, int channelId)
    {
        await sender.Send(new DeleteKurdnezamContactChannelCommand(channelId));
        return TypedResults.NoContent();
    }
}
