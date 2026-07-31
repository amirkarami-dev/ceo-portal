using Microsoft.Extensions.DependencyInjection;

namespace Mabhas19.Application.FunctionalTests;

[SetUpFixture]
public class FunctionalTestSetup
{
    internal static IServiceScopeFactory ScopeFactory { get; private set; } = null!;
    internal static DatabaseResetter? DbResetter { get; private set; }
    internal static string ConnectionString { get; private set; } = null!;

    /// <summary>The fake membership directory the API is wired to, for tests to arrange.</summary>
    internal static FakeEngineerDirectory Directory => Factory.Directory;

    /// <summary>What the Bale bot would have sent.</summary>
    internal static FakeBaleClient Bale => Factory.Bale;

    /// <summary>The OTP codes the bot issued, through the real limit logic.</summary>
    internal static RecordingVoteOtpStore? Otp => Factory.Otp;

    internal static FakeVoteOtpSender OtpSender => Factory.OtpSender;

    /// <summary>The stand-in media server: head-counts to arrange, ended rooms to assert on.</summary>
    internal static FakeLiveKitAdmin LiveKit => Factory.LiveKit;

    /// <summary>
    /// A real HTTP client against the test host.
    /// </summary>
    /// <remarks>
    /// Almost every test goes through MediatR instead, which is faster and asserts on typed results.
    /// This exists for the handful of things that only exist in the HTTP pipeline — route wiring and
    /// the authorisation middleware — and which a handler test would happily pass without.
    /// </remarks>
    internal static HttpClient CreateClient() => Factory.CreateClient();

    private static WebApiFactory Factory =>
        _factory ?? throw new InvalidOperationException("Test host not started.");

    private static WebApiFactory? _factory;
    private static DistributedApplication? _app;

    [OneTimeSetUp]
    public async Task OneTimeSetUp()
    {
        var cts = new CancellationTokenSource(TimeSpan.FromSeconds(60));
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

        ConnectionString = connectionString;
        _factory = new WebApiFactory(connectionString);
        ScopeFactory = _factory.Services.GetRequiredService<IServiceScopeFactory>();
        DbResetter = await DatabaseResetter.CreateAsync(connectionString);
    }

    [OneTimeTearDown]
    public async Task OneTimeTearDown()
    {
        if (DbResetter is not null) await DbResetter.DisposeAsync();
        if (_app is not null) await _app.DisposeAsync();
        if (_factory is not null) await _factory.DisposeAsync();
    }
}
