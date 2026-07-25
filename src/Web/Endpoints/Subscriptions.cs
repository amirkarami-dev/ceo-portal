using Mabhas19.Application.Subscriptions.Queries.GetMySubscription;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints;

public class Subscriptions : IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization();

        groupBuilder.MapGet(GetMySubscription, "me");
    }

    public static async Task<Ok<SubscriptionDto>> GetMySubscription(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetMySubscriptionQuery()));
}
