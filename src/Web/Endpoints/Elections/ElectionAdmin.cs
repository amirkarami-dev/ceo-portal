using Mabhas19.Application.Elections;
using Mabhas19.Domain.Constants;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Elections;

/// <summary>
/// Admin management of elections. Auto-mapped to <c>/api/ElectionAdmin</c>.
/// </summary>
/// <remarks>
/// <para>
/// Administrator-only, at the group level. Every handler here is about defining an election — none of
/// them reads a ballot or a voter roll, and none ever will: the adversarial review found that an
/// admin endpoint taking a کد ملی is a plaintext voter roll, so there is deliberately no
/// "did this person vote?" route. Admins see counts.
/// </para>
/// <para>
/// Voting itself is NOT here. It gets its own group with its own rules, because a cast must never
/// accept a voter identifier from the request body.
/// </para>
/// </remarks>
public class ElectionAdmin : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/ElectionAdmin";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization(policy => policy.RequireRole(Roles.Administrator));

        groupBuilder.MapGet(GetElections, string.Empty);
        groupBuilder.MapGet(GetElection, "{id:int}");
        groupBuilder.MapPost(CreateElection, string.Empty);
        groupBuilder.MapPut(UpdateElection, "{id:int}");
        groupBuilder.MapPost(PublishElection, "{id:int}/publish");
        groupBuilder.MapPost(CancelElection, "{id:int}/cancel");
        groupBuilder.MapPost(TallyElection, "{id:int}/tally");
        groupBuilder.MapDelete(DeleteElection, "{id:int}");
    }

    public static async Task<Ok<IReadOnlyList<ElectionListItemDto>>> GetElections(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetElectionsQuery()));

    public static async Task<Ok<ElectionDetailDto>> GetElection(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new GetElectionQuery(id)));

    public static async Task<Created<int>> CreateElection(ISender sender, CreateElectionCommand command)
    {
        var id = await sender.Send(command);
        return TypedResults.Created($"/api/ElectionAdmin/{id}", id);
    }

    /// <summary>
    /// The route id wins over any id in the body — otherwise a caller could PUT to one election and
    /// edit another. Same reason the cast endpoint will not accept a voter identifier from the body.
    /// </summary>
    public static async Task<Results<NoContent, BadRequest>> UpdateElection(
        ISender sender, int id, UpdateElectionCommand command)
    {
        if (command.Id != 0 && command.Id != id)
        {
            return TypedResults.BadRequest();
        }

        await sender.Send(command with { Id = id });
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> PublishElection(ISender sender, int id)
    {
        await sender.Send(new PublishElectionCommand(id));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> CancelElection(ISender sender, int id)
    {
        await sender.Send(new CancelElectionCommand(id));
        return TypedResults.NoContent();
    }

    /// <summary>
    /// Count the ballots and publish «نتیجه انتخابات». Re-runnable during the 30-day retention window;
    /// the digest makes a recount safe by refusing if the ballots changed since the first count.
    /// </summary>
    public static async Task<Ok<TallyOutcome>> TallyElection(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new TallyElectionCommand(id)));

    public static async Task<NoContent> DeleteElection(ISender sender, int id)
    {
        await sender.Send(new DeleteElectionCommand(id));
        return TypedResults.NoContent();
    }
}
