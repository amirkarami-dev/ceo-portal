using Mabhas19.Application.Kurdnezam.People;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>
/// The organisation's people (board, inspectors, councils) for the kurdnezam landing site.
/// Reads are public; writes require the Administrator role.
/// </summary>
/// <remarks>
/// Handler method names are globally unique on purpose — <c>EndpointRouteBuilderExtensions</c>
/// derives the endpoint name (and OpenAPI operationId) from the method name, and duplicate names
/// across groups break route matching for the whole API.
/// </remarks>
public class KurdnezamPeople : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/kurdnezam/people";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetKurdnezamPeople, string.Empty).AllowAnonymous();
        groupBuilder.MapGet(GetKurdnezamPersonById, "{id:int}").AllowAnonymous();

        groupBuilder.MapPost(CreateKurdnezamPerson, string.Empty).RequireAdmin();
        groupBuilder.MapPut(UpdateKurdnezamPerson, "{id:int}").RequireAdmin();
        groupBuilder.MapDelete(DeleteKurdnezamPerson, "{id:int}").RequireAdmin();
    }

    public static async Task<Ok<IReadOnlyList<KurdnezamPersonDto>>> GetKurdnezamPeople(
        ISender sender,
        string? group = null)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamPeopleQuery(group)));

    public static async Task<Ok<KurdnezamPersonDto>> GetKurdnezamPersonById(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new GetKurdnezamPersonByIdQuery(id)));

    public static async Task<Created<int>> CreateKurdnezamPerson(ISender sender, KurdnezamPersonInput body)
    {
        var id = await sender.Send(new CreateKurdnezamPersonCommand(body));
        return TypedResults.Created($"/api/kurdnezam/people/{id}", id);
    }

    public static async Task<NoContent> UpdateKurdnezamPerson(ISender sender, int id, KurdnezamPersonInput body)
    {
        await sender.Send(new UpdateKurdnezamPersonCommand(id, body));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteKurdnezamPerson(ISender sender, int id)
    {
        await sender.Send(new DeleteKurdnezamPersonCommand(id));
        return TypedResults.NoContent();
    }
}
