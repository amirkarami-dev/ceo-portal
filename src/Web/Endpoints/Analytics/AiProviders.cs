using System.Text.Json.Nodes;
using Mabhas19.Application.Analytics.AiProviders;
using Mabhas19.Application.Analytics.AiProviders.Commands.UpsertAiProvider;
using Mabhas19.Application.Analytics.AiProviders.Queries.GetAiProviders;
using Mabhas19.Domain.Constants;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Analytics;

/// <summary>
/// AI provider configuration endpoints (admin-only).
/// Auto-mapped to <c>/api/AiProviders</c>.
/// </summary>
public class AiProviders : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization(policy => policy.RequireRole(Roles.Administrator));

        groupBuilder.MapGet(GetAiProviders,    string.Empty);
        groupBuilder.MapPost(UpsertAiProvider, string.Empty);
    }

    public static async Task<Ok<IReadOnlyList<AiProviderDto>>> GetAiProviders(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetAiProvidersQuery()));

    public static async Task<Ok<int>> UpsertAiProvider(ISender sender, UpsertAiProviderRequest request)
        => TypedResults.Ok(await sender.Send(new UpsertAiProviderCommand(request.Type, request.Enabled, request.Config)));
}

/// <summary>Request body for POST /api/AiProviders.</summary>
public sealed record UpsertAiProviderRequest(string Type, bool Enabled, JsonObject Config);
