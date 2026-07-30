using Mabhas19.Application.Elections;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Elections;

/// <summary>
/// The voter-facing endpoints. Auto-mapped to <c>/api/Election</c>.
/// </summary>
/// <remarks>
/// <para>
/// Authenticated, but <b>not</b> Administrator — these are for ordinary engineers. Admin management
/// lives in <see cref="ElectionAdmin"/>.
/// </para>
/// <para>
/// <b>Note what the cast route does not take.</b> The body is <c>{ electionId, candidateIds }</c> and
/// nothing else. Identity comes from the token, never the request — this repo binds whole commands from
/// the body, so a voter field here would let anyone vote as anyone whose کد ملی they know, and کد ملی
/// is not secret in Iran.
/// </para>
/// </remarks>
public class Election : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/Election";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization();

        groupBuilder.MapGet(GetMyBallots, "MyBallots");
        groupBuilder.MapPost(CastVote, "Cast");
        groupBuilder.MapGet(GetResult, "{id:int}/result");
    }

    /// <summary>Published elections, each with whether this person may vote and why not.</summary>
    public static async Task<Ok<IReadOnlyList<BallotDto>>> GetMyBallots(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetMyBallotsQuery()));

    /// <summary>
    /// Cast a ballot. A refusal comes back as a 400 with a Persian reason from the
    /// ProblemDetails handler, so the voter is told WHICH condition failed rather than just "no".
    /// </summary>
    public static async Task<Ok<CastVoteResult>> CastVote(ISender sender, CastVoteCommand command)
        => TypedResults.Ok(await sender.Send(command));

    /// <summary>
    /// «نتیجه انتخابات» — available to any authenticated member once the election has been tallied. A
    /// result nobody can read is not a result.
    /// </summary>
    public static async Task<Ok<ElectionResultDto>> GetResult(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new GetElectionResultQuery(id)));
}
