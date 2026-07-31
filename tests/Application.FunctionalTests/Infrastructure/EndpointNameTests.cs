using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Mabhas19.Application.FunctionalTests.Infrastructure;

/// <summary>
/// Every endpoint name in the API is unique.
/// </summary>
/// <remarks>
/// <para>
/// The endpoint mapper turns each handler's <b>method name</b> into the endpoint name
/// (<c>EndpointRouteBuilderExtensions</c>), and ASP.NET Core requires those to be unique across the
/// whole application, not per route group. Two groups with a method called <c>GetRoom</c> is legal C#,
/// compiles clean, and starts up fine — and then <b>every route in the API answers 500</b>, including
/// ones that have nothing to do with either group.
/// </para>
/// <para>
/// It happened. It cost a full test run to find, because handler tests that go through MediatR never
/// touch HTTP and all stayed green. This is the cheap check that turns it into one failing test with
/// the colliding name printed.
/// </para>
/// </remarks>
public class EndpointNameTests : TestBase
{
    [Test]
    public void No_two_endpoints_share_a_name()
    {
        var source = FunctionalTestSetup.ScopeFactory.CreateScope()
            .ServiceProvider.GetRequiredService<EndpointDataSource>();

        var duplicates = source.Endpoints
            .Select(e => e.Metadata.GetMetadata<IEndpointNameMetadata>()?.EndpointName)
            .Where(name => !string.IsNullOrEmpty(name))
            .GroupBy(name => name, StringComparer.Ordinal)
            .Where(g => g.Count() > 1)
            .Select(g => $"{g.Key} ×{g.Count()}")
            .ToList();

        duplicates.ShouldBeEmpty(
            "Two endpoint handlers share a method name. Endpoint names are GLOBAL, so this makes "
            + "every route in the API return 500. Prefix the handler with its area — GetRoomAdmin, "
            + "GetKurdnezamNews, CreateWalfareService.");
    }
}
