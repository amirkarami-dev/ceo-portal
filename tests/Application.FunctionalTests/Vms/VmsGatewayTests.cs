using System.Net;
using System.Net.Http.Json;
using Mabhas19.Application.Vms;
using Mabhas19.Domain.Vms;

namespace Mabhas19.Application.FunctionalTests.Vms;

/// <summary>
/// The route the media VPS calls to rebuild go2rtc's configuration.
/// </summary>
/// <remarks>
/// Every assertion here is over real HTTP, because the whole point of this route is the token check —
/// and a token check lives in the endpoint, where a MediatR test would never reach it.
/// </remarks>
public class VmsGatewayTests : TestBase
{
    private const string Path = "/api/VmsGateway/config";
    private const string Header = "X-Vms-Gateway-Token";

    private static async Task SeedCameraAsync(
        string streamKey = "baneh-01", string cred = "default", bool active = true)
    {
        if (!(await TestApp.AllAsync<VmsCity>()).Any(c => c.Code == "baneh"))
        {
            await TestApp.AddAsync(new VmsCity { Code = "baneh", Name = "بانه", DisplayOrder = 10 });
        }

        await TestApp.AddAsync(new Camera
        {
            Name = "دوربین راه‌پله",
            CityCode = "baneh",
            Host = "78.39.233.70",
            RtspPort = 554,
            StreamKey = streamKey,
            CredentialKey = cred,
            Channel = 1,
            SubStreamId = 2,
            IsActive = active
        });
    }

    private static HttpClient Client(string? token)
    {
        var client = FunctionalTestSetup.CreateClient();
        if (token is not null)
        {
            client.DefaultRequestHeaders.Add(Header, token);
        }

        return client;
    }

    // ── the gate ─────────────────────────────────────────────────────────────

    [Test]
    public async Task Without_a_token_the_camera_inventory_is_refused()
    {
        using var client = Client(null);

        // It carries no passwords, but it does list the hosts and ports of devices on private
        // networks, which is worth something to somebody without the pictures.
        (await client.GetAsync(Path)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Test]
    public async Task A_wrong_token_is_refused()
    {
        using var client = Client("not-the-token");

        (await client.GetAsync(Path)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Test]
    public async Task A_token_that_is_a_prefix_of_the_real_one_is_refused()
    {
        // The comparison hashes both sides before comparing, so neither length nor a shared prefix
        // leaks through timing. This asserts the plain outcome; the timing property is structural.
        using var client = Client(WebApiFactory.TestVmsGatewayToken[..10]);

        (await client.GetAsync(Path)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Test]
    public async Task An_ordinary_signed_in_administrator_cannot_use_this_route()
    {
        await TestApp.RunAsAdministratorAsync();

        // The route is anonymous-plus-token, not role-gated: a browser session is the wrong kind of
        // caller for it, and a human should be reading /api/VmsAdmin instead.
        using var client = Client(null);

        (await client.GetAsync(Path)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    // ── what it returns ──────────────────────────────────────────────────────

    [Test]
    public async Task With_the_token_it_returns_the_streams_block()
    {
        await SeedCameraAsync();

        using var client = Client(WebApiFactory.TestVmsGatewayToken);
        var response = await client.GetAsync(Path);

        response.StatusCode.ShouldBe(HttpStatusCode.OK);

        var config = await response.Content.ReadFromJsonAsync<VmsGatewayConfigDto>();

        config.ShouldNotBeNull();
        config!.CameraCount.ShouldBe(1);
        config.CredentialKeys.ShouldBe(["default"]);
        config.StreamsYaml.ShouldContain(
            "baneh-01: 'rtsp://{{cred:default}}@78.39.233.70:554/mode=real&idc=1&ids=2'");
    }

    [Test]
    public async Task The_response_never_carries_a_password()
    {
        await SeedCameraAsync();

        using var client = Client(WebApiFactory.TestVmsGatewayToken);
        var body = await (await client.GetAsync(Path)).Content.ReadAsStringAsync();

        // The database has none to give, and this is the seam where one could appear by accident.
        body.ShouldContain("{{cred:default}}");
        body.ShouldNotContain("password", Case.Insensitive);
        body.ShouldNotContain("admin:");
    }

    [Test]
    public async Task A_switched_off_camera_is_absent_from_the_config()
    {
        await SeedCameraAsync(streamKey: "baneh-01");
        await SeedCameraAsync(streamKey: "baneh-02", active: false);

        using var client = Client(WebApiFactory.TestVmsGatewayToken);
        var config = await (await client.GetAsync(Path)).Content
            .ReadFromJsonAsync<VmsGatewayConfigDto>();

        // go2rtc only dials a camera somebody is watching — but a stream it does not know about
        // cannot be watched at all, which is what "switched off" has to mean.
        config!.CameraCount.ShouldBe(1);
        config.StreamsYaml.ShouldNotContain("baneh-02");
    }

    [Test]
    public async Task Every_credential_key_in_use_is_declared_for_the_agent_to_check()
    {
        await SeedCameraAsync(streamKey: "baneh-01", cred: "default");
        await SeedCameraAsync(streamKey: "baneh-02", cred: "qorveh");

        using var client = Client(WebApiFactory.TestVmsGatewayToken);
        var config = await (await client.GetAsync(Path)).Content
            .ReadFromJsonAsync<VmsGatewayConfigDto>();

        // The agent refuses to write a config it cannot complete, and this list is what it checks
        // against the credentials it holds. A key missing from it would become a stream that fails
        // to authenticate with nothing anywhere saying why.
        config!.CredentialKeys.ShouldBe(["default", "qorveh"]);
    }

    [Test]
    public async Task The_wire_property_names_are_what_the_sync_script_reads()
    {
        await SeedCameraAsync();

        using var client = Client(WebApiFactory.TestVmsGatewayToken);
        var json = await (await client.GetAsync(Path)).Content.ReadAsStringAsync();

        // scripts/vms-sync.sh is not C# and does not share these names — it reads them out of the
        // JSON by hand. Renaming a DTO property here would compile, pass every other test, and then
        // break the sync on the VPS with a KeyError nobody is watching for. Same class of bug as the
        // snake_case Bale payload in GOTCHAS: only a test that reads real bytes can see it.
        using var doc = System.Text.Json.JsonDocument.Parse(json);
        var names = doc.RootElement.EnumerateObject().Select(p => p.Name).Order(StringComparer.Ordinal);

        names.ShouldBe(["cameraCount", "credentialKeys", "generatedAtUtc", "streamsYaml"]);
    }

    [Test]
    public async Task An_empty_estate_still_returns_a_config_go2rtc_can_load()
    {
        using var client = Client(WebApiFactory.TestVmsGatewayToken);
        var config = await (await client.GetAsync(Path)).Content
            .ReadFromJsonAsync<VmsGatewayConfigDto>();

        config!.CameraCount.ShouldBe(0);
        config.StreamsYaml.ShouldBe("streams:\n  {}\n");
    }
}
