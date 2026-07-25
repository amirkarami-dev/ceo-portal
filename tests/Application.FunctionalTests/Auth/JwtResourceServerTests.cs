using System.Net;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using Mabhas19.Application.FunctionalTests.Infrastructure;
using Microsoft.IdentityModel.Tokens;

namespace Mabhas19.Application.FunctionalTests.Auth;

/// <summary>
/// Phase-1 exit gate: proves the mabhas19 API, configured as a JWT resource server,
/// enforces the token contract without relying on a live IdP.
///
/// The factory is shared across all four test cases (OneTimeSetUp / OneTimeTearDown).
/// It does NOT replace IUser with a mock — the real CurrentUser reads claims from the
/// validated JWT so the full authentication + authorisation pipeline is exercised.
/// </summary>
[TestFixture]
public class JwtResourceServerTests
{
    private RSA _rsa = null!;
    private RsaSecurityKey _testKey = null!;

    private JwtWebApiFactory _factory = null!;
    private HttpClient _client = null!;

    [OneTimeSetUp]
    public void OneTimeSetUp()
    {
        _rsa = RSA.Create(2048);
        _testKey = new RsaSecurityKey(_rsa);

        // Depends on FunctionalTestSetup having already run (assembly-level [SetUpFixture])
        // and having stored the Aspire connection string.
        _factory = new JwtWebApiFactory(FunctionalTestSetup.ConnectionString, _testKey);
        _client = _factory.CreateClient();
    }

    [OneTimeTearDown]
    public void OneTimeTearDown()
    {
        _client.Dispose();
        _factory.Dispose();
        _rsa.Dispose();
    }

    // -------------------------------------------------------------------------
    // Case 1: Valid JWT with correct issuer, audience, sub, and role=User → 200
    // -------------------------------------------------------------------------
    [Test]
    public async Task ValidToken_GetProjects_Returns200()
    {
        var token = JwtTokenHelper.IssueToken(_testKey, sub: "user-1", roles: ["User"]);

        _client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        var response = await _client.GetAsync("/api/Projects");

        response.StatusCode.ShouldBe(HttpStatusCode.OK,
            $"A valid JWT should grant access to GET /api/Projects. Actual: {(int)response.StatusCode} {response.ReasonPhrase}");
    }

    // -------------------------------------------------------------------------
    // Case 2: No token → 401
    // -------------------------------------------------------------------------
    [Test]
    public async Task NoToken_GetProjects_Returns401()
    {
        using var anonClient = _factory.CreateClient();
        // Deliberately send no Authorization header.
        anonClient.DefaultRequestHeaders.Authorization = null;

        var response = await anonClient.GetAsync("/api/Projects");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized,
            $"A request without a token must be rejected with 401. Actual: {(int)response.StatusCode} {response.ReasonPhrase}");
    }

    // -------------------------------------------------------------------------
    // Case 3: Token with wrong audience → 401
    // -------------------------------------------------------------------------
    [Test]
    public async Task WrongAudience_GetProjects_Returns401()
    {
        var token = JwtTokenHelper.IssueToken(
            _testKey,
            sub: "user-1",
            roles: ["User"],
            audience: "wrong-api");

        using var anonClient = _factory.CreateClient();
        anonClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await anonClient.GetAsync("/api/Projects");

        response.StatusCode.ShouldBe(HttpStatusCode.Unauthorized,
            $"A token with the wrong audience must be rejected with 401. Actual: {(int)response.StatusCode} {response.ReasonPhrase}");
    }

    // -------------------------------------------------------------------------
    // Case 4a: User-only token → admin endpoint → 403
    // Case 4b: Administrator token → admin endpoint → NOT 403
    // -------------------------------------------------------------------------
    [Test]
    public async Task UserToken_AdminEndpoint_Returns403()
    {
        var token = JwtTokenHelper.IssueToken(_testKey, sub: "user-1", roles: ["User"]);

        using var userClient = _factory.CreateClient();
        userClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await userClient.GetAsync("/api/Admin/users");

        response.StatusCode.ShouldBe(HttpStatusCode.Forbidden,
            $"A User-only JWT must be refused access to the Administrator-gated endpoint with 403. Actual: {(int)response.StatusCode} {response.ReasonPhrase}");
    }

    [Test]
    public async Task AdministratorToken_AdminEndpoint_IsNotForbidden()
    {
        var token = JwtTokenHelper.IssueToken(_testKey, sub: "admin-1", roles: ["Administrator"]);

        using var adminClient = _factory.CreateClient();
        adminClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        var response = await adminClient.GetAsync("/api/Admin/users");
        var body = await response.Content.ReadAsStringAsync();

        response.StatusCode.ShouldNotBe(HttpStatusCode.Forbidden,
            $"An Administrator JWT must not be refused with 403. Actual: {(int)response.StatusCode} {response.ReasonPhrase}");
        response.StatusCode.ShouldNotBe(HttpStatusCode.Unauthorized,
            $"An Administrator JWT must not receive 401. Actual: {(int)response.StatusCode} {response.ReasonPhrase}");
    }
}
