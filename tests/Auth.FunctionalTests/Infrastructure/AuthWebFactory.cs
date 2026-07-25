using Mabhas19.Auth;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;

namespace Mabhas19.Auth.FunctionalTests.Infrastructure;

/// <summary>
/// <see cref="WebApplicationFactory{TEntryPoint}"/> for the Auth IdP.
/// Targets <see cref="AuthApiMarker"/> (in <c>Mabhas19.Auth</c>) to avoid ambiguity
/// with the top-level <c>Program</c> class in <c>Mabhas19.Web</c>.
/// </summary>
public class AuthWebFactory(string connectionString) : WebApplicationFactory<AuthApiMarker>
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Run in Development so OpenIddict's DisableTransportSecurityRequirement is active
        // (the in-memory test server uses plain HTTP).
        builder.UseEnvironment("Development");

        builder.UseSetting("ConnectionStrings:Mabhas19AuthDb", connectionString);
    }
}
