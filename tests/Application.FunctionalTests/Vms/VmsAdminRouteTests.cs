using System.Net;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Routing.Patterns;
using Microsoft.Extensions.DependencyInjection;

namespace Mabhas19.Application.FunctionalTests.Vms;

/// <summary>
/// The VMS admin routes exist and are shut to everyone but an administrator.
/// </summary>
/// <remarks>
/// Everything else in <c>CameraAdminTests</c> goes through MediatR, which never touches HTTP. That is
/// exactly the blind spot that let a duplicate handler name reach production and make <b>every</b>
/// route in the API answer 500 while the room tests stayed green — see GOTCHAS. So this fixture asks
/// the real routing table what got mapped, and makes one real unauthenticated request.
/// </remarks>
public class VmsAdminRouteTests : TestBase
{
    private static IReadOnlyList<string> MappedRoutes()
    {
        using var scope = FunctionalTestSetup.ScopeFactory.CreateScope();
        var source = scope.ServiceProvider.GetRequiredService<EndpointDataSource>();

        return
        [
            .. source.Endpoints
                .OfType<RouteEndpoint>()
                .Select(e => $"{Verb(e)} /{e.RoutePattern.RawText?.TrimStart('/')}")
                .Where(r => r.Contains("/api/VmsAdmin", StringComparison.OrdinalIgnoreCase))
                .Order(StringComparer.Ordinal)
        ];
    }

    private static string Verb(RouteEndpoint e) =>
        e.Metadata.GetMetadata<HttpMethodMetadata>()?.HttpMethods.FirstOrDefault() ?? "?";

    [Test]
    public void Every_admin_route_is_actually_mapped()
    {
        var routes = MappedRoutes();

        // Spelled out rather than counted, so adding a route without noticing it is unreachable — or
        // renaming one and breaking a SPA — fails here with the difference printed.
        //
        // The two collection routes carry a trailing slash because the group maps them at
        // string.Empty, the same as RoomAdmin. Both spellings still match at request time — the
        // unauthenticated test below asks for "/api/VmsAdmin" and gets 401 rather than 404.
        routes.ShouldBe(
        [
            "DELETE /api/VmsAdmin/{id:int}",
            "GET /api/VmsAdmin/",
            "GET /api/VmsAdmin/cities",
            "GET /api/VmsAdmin/{id:int}",
            "POST /api/VmsAdmin/",
            "POST /api/VmsAdmin/{id:int}/active",
            "PUT /api/VmsAdmin/{id:int}",
        ]);
    }

    [Test]
    public async Task An_unauthenticated_request_is_refused_at_the_door()
    {
        using var client = FunctionalTestSetup.CreateClient();

        var response = await client.GetAsync("/api/VmsAdmin");

        // 401, not 404 and certainly not 200. A camera list names hosts and ports of devices on
        // private networks, which is worth something to somebody even without the pictures.
        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Test]
    public async Task The_camera_list_route_does_not_answer_500()
    {
        using var client = FunctionalTestSetup.CreateClient();

        // A duplicate endpoint name does not fail at startup — it fails on the first request, on
        // every route. An unauthenticated 401 proves routing itself is intact.
        var response = await client.GetAsync("/api/VmsAdmin/cities");

        ((int)response.StatusCode).ShouldBeLessThan(500);
    }
}
