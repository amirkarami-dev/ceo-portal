using System.Text.Json;

namespace Mabhas19.Auth.FunctionalTests;

[TestFixture]
public class DiscoveryTests
{
    private HttpClient _client = null!;

    [SetUp]
    public void SetUp()
    {
        _client = AuthFunctionalTestSetup.Factory.CreateClient();
    }

    [TearDown]
    public void TearDown()
    {
        _client.Dispose();
    }

    [Test]
    public async Task Discovery_has_issuer_and_endpoints()
    {
        var response = await _client.GetAsync("/.well-known/openid-configuration");

        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        root.GetProperty("issuer").GetString().ShouldNotBeNullOrEmpty();

        root.GetProperty("authorization_endpoint").GetString()!
            .ShouldContain("connect/authorize");

        root.GetProperty("token_endpoint").GetString()!
            .ShouldContain("connect/token");

        root.GetProperty("userinfo_endpoint").GetString()
            .ShouldNotBeNullOrEmpty();

        // OpenIddict exposes end_session_endpoint
        root.GetProperty("end_session_endpoint").GetString()
            .ShouldNotBeNullOrEmpty();
    }

    [Test]
    public async Task Discovery_advertises_api_scope_and_pkce()
    {
        var response = await _client.GetAsync("/.well-known/openid-configuration");

        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);
        var root = doc.RootElement;

        var scopes = root.GetProperty("scopes_supported")
            .EnumerateArray()
            .Select(e => e.GetString()!)
            .ToList();

        scopes.ShouldContain("mabhas19.api");
        scopes.ShouldContain("plan.api");

        var codeChallenges = root.GetProperty("code_challenge_methods_supported")
            .EnumerateArray()
            .Select(e => e.GetString()!)
            .ToList();

        codeChallenges.ShouldContain("S256");

        var grantTypes = root.GetProperty("grant_types_supported")
            .EnumerateArray()
            .Select(e => e.GetString()!)
            .ToList();

        grantTypes.ShouldContain("authorization_code");
        grantTypes.ShouldContain("refresh_token");
    }

    [Test]
    public async Task Jwks_endpoint_returns_keys()
    {
        // OpenIddict publishes JWKS at /.well-known/jwks (not /jwks_uri suffix)
        var discoveryResponse = await _client.GetAsync("/.well-known/openid-configuration");
        discoveryResponse.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK);

        var discoveryBody = await discoveryResponse.Content.ReadAsStringAsync();
        using var discoveryDoc = JsonDocument.Parse(discoveryBody);

        // Derive the JWKS URI from the discovery document
        var jwksUri = discoveryDoc.RootElement.GetProperty("jwks_uri").GetString()!;
        jwksUri.ShouldNotBeNullOrEmpty();

        // The factory's base address is http://localhost; make the URI relative
        var jwksPath = new Uri(jwksUri).PathAndQuery;

        var response = await _client.GetAsync(jwksPath);
        response.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK);

        var body = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(body);

        var keys = doc.RootElement.GetProperty("keys").EnumerateArray().ToList();
        keys.ShouldNotBeEmpty();
    }
}
