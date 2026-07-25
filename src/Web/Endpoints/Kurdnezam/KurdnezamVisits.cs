using Mabhas19.Application.Kurdnezam.Visits;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>
/// Visit tracking for the public site. The counters it feeds are returned by
/// <c>GET /api/kurdnezam/settings</c> (<c>stats</c>).
/// </summary>
public class KurdnezamVisits : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/kurdnezam/visits";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        // Anonymous by design: every public page view calls this.
        groupBuilder.MapPost(TrackKurdnezamVisit, string.Empty).AllowAnonymous();
    }

    public static async Task<NoContent> TrackKurdnezamVisit(ISender sender, TrackKurdnezamVisitRequest body)
    {
        await sender.Send(new TrackKurdnezamVisitCommand(body.SessionId, body.Path));
        return TypedResults.NoContent();
    }
}

/// <summary>Request body for POST /api/kurdnezam/visits.</summary>
public sealed record TrackKurdnezamVisitRequest(string SessionId, string Path);
