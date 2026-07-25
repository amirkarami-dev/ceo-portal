using Mabhas19.Application.Kurdnezam.Common;
using Mabhas19.Application.Kurdnezam.Contact;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>
/// The contact inbox. Submitting is public (the form at <c>/p/tamas</c>); reading, triaging, and
/// deleting require the Administrator role.
/// </summary>
/// <remarks>
/// Handler method names are globally unique on purpose — <c>EndpointRouteBuilderExtensions</c>
/// derives the endpoint name (and OpenAPI operationId) from the method name, and duplicate names
/// across groups break route matching for the whole API.
/// </remarks>
public class KurdnezamContactMessages : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/kurdnezam/contact-messages";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapPost(CreateKurdnezamContactMessage, string.Empty).AllowAnonymous();

        groupBuilder.MapGet(GetKurdnezamContactMessages, string.Empty).RequireAdmin();
        groupBuilder.MapPut(SetKurdnezamContactMessageRead, "{id:int}/read").RequireAdmin();
        groupBuilder.MapDelete(DeleteKurdnezamContactMessage, "{id:int}").RequireAdmin();
    }

    public static async Task<Created<int>> CreateKurdnezamContactMessage(ISender sender, KurdnezamContactMessageInput body)
    {
        var id = await sender.Send(new CreateKurdnezamContactMessageCommand(body));
        return TypedResults.Created($"/api/kurdnezam/contact-messages/{id}", id);
    }

    public static async Task<Ok<KurdnezamPagedResult<KurdnezamContactMessageDto>>> GetKurdnezamContactMessages(
        ISender sender,
        bool? isRead = null,
        int page = 1,
        int pageSize = 20)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamContactMessagesQuery(isRead, page, pageSize)));

    public static async Task<NoContent> SetKurdnezamContactMessageRead(ISender sender, int id, KurdnezamContactMessageReadInput body)
    {
        await sender.Send(new SetKurdnezamContactMessageReadCommand(id, body.IsRead));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteKurdnezamContactMessage(ISender sender, int id)
    {
        await sender.Send(new DeleteKurdnezamContactMessageCommand(id));
        return TypedResults.NoContent();
    }
}
