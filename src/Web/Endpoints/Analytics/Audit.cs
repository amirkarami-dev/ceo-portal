using Mabhas19.Application.Analytics.Audit;
using Mabhas19.Application.Analytics.Audit.Queries.GetAuditEvents;
using Mabhas19.Domain.Constants;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Analytics;

/// <summary>
/// Audit log endpoints (admin-only).
/// Auto-mapped to <c>/api/Audit</c>.
/// </summary>
public class Audit : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization(policy => policy.RequireRole(Roles.Administrator));

        groupBuilder.MapGet(GetAuditEvents, string.Empty);
    }

    public static async Task<Ok<IReadOnlyList<AuditEventDto>>> GetAuditEvents(
        ISender sender,
        string? type   = null,
        string? status = null)
        => TypedResults.Ok(await sender.Send(new GetAuditEventsQuery(type, status)));
}
