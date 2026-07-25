using Mabhas19.Auth.FunctionalTests.Infrastructure;

namespace Mabhas19.Auth.FunctionalTests;

[SetUpFixture]
public class AuthFunctionalTestSetup
{
    internal static AuthWebFactory Factory { get; private set; } = null!;

    private static DistributedApplication? _app;

    [OneTimeSetUp]
    public async Task OneTimeSetUp()
    {
        var cts = new CancellationTokenSource(TimeSpan.FromSeconds(120));
        var cancellationToken = cts.Token;

        var builder = await DistributedApplicationTestingBuilder
            .CreateAsync<global::Projects.TestAppHost>(
                args: [],
                configureBuilder: (options, _) =>
                {
                    options.DisableDashboard = true;
                });

        builder.Configuration["ASPIRE_ALLOW_UNSECURED_TRANSPORT"] = "true";

        _app = await builder
            .BuildAsync(cancellationToken)
            .WaitAsync(cancellationToken);

        await _app
            .StartAsync(cancellationToken)
            .WaitAsync(cancellationToken);

        await _app.ResourceNotifications.WaitForResourceHealthyAsync(
            Services.Database, cancellationToken);

        var connectionString = (await _app.GetConnectionStringAsync(Services.Database))!;

        Factory = new AuthWebFactory(connectionString);

        // Eagerly initialise the factory so the Auth DB is migrated + seeded before
        // individual tests run (CreateClient triggers the WebApplicationFactory startup).
        _ = Factory.CreateClient();
    }

    [OneTimeTearDown]
    public async Task OneTimeTearDown()
    {
        if (_app is not null) await _app.DisposeAsync();
        if (Factory is not null) await Factory.DisposeAsync();
    }
}
