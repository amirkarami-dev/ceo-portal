using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;

namespace Mabhas19.Application.FunctionalTests.Vms;

/// <summary>
/// The media session: an administrator's bearer token in, a cookie out, and the
/// <c>forwardAuth</c> answer Traefik acts on.
/// </summary>
/// <remarks>
/// <para>
/// All of it over real HTTP with a real JWT, because all of it lives in the HTTP layer — cookie
/// attributes, an anonymous route inside an authorised group, and a status code another machine keys
/// on. A MediatR test would touch none of it.
/// </para>
/// <para>
/// The client does not use a cookie jar. <c>Secure</c> cookies are not stored for an <c>http://</c>
/// test host, and reading the header by hand is what actually asserts the attributes anyway.
/// </para>
/// </remarks>
[TestFixture]
public class VmsMediaSessionTests
{
    private const string SessionPath = "/api/VmsMedia/session";
    private const string CheckPath = "/api/VmsMedia/check";

    private RSA _rsa = null!;
    private RsaSecurityKey _key = null!;
    private JwtWebApiFactory _factory = null!;

    [OneTimeSetUp]
    public void OneTimeSetUp()
    {
        _rsa = RSA.Create(2048);
        _key = new RsaSecurityKey(_rsa);
        _factory = new JwtWebApiFactory(FunctionalTestSetup.ConnectionString, _key);
    }

    [OneTimeTearDown]
    public void OneTimeTearDown()
    {
        _factory.Dispose();
        _rsa.Dispose();
    }

    private HttpClient AsAdmin()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer", JwtTokenHelper.IssueToken(_key, sub: "admin-1", roles: ["Administrator"]));
        return client;
    }

    private HttpClient AsUser()
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue(
            "Bearer", JwtTokenHelper.IssueToken(_key, sub: "user-1", roles: ["User"]));
        return client;
    }

    private static string SetCookieHeader(HttpResponseMessage response) =>
        response.Headers.TryGetValues("Set-Cookie", out var values)
            ? values.First(v => v.StartsWith("vms_media=", StringComparison.Ordinal))
            : throw new InvalidOperationException("no vms_media cookie was set");

    /// <summary>The bare <c>name=value</c>, as a browser would send it back.</summary>
    private static string CookiePair(HttpResponseMessage response) =>
        SetCookieHeader(response).Split(';')[0];

    // ── who may open a session ───────────────────────────────────────────────

    [Test]
    public async Task An_anonymous_caller_cannot_open_a_media_session()
    {
        using var client = _factory.CreateClient();

        (await client.PostAsync(SessionPath, null)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Test]
    public async Task A_signed_in_non_administrator_cannot_open_a_media_session()
    {
        using var client = AsUser();

        // Administrators only. There is no non-admin audience for this service, so a cookie for a
        // plain user would be a key to a wall of cameras issued to somebody with no business there.
        (await client.PostAsync(SessionPath, null)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    // ── the cookie ───────────────────────────────────────────────────────────

    [Test]
    public async Task An_administrator_gets_a_cookie_the_browser_will_hand_to_the_gateway()
    {
        using var client = AsAdmin();

        var response = await client.PostAsync(SessionPath, null);
        response.StatusCode.ShouldBe(HttpStatusCode.OK);

        var cookie = SetCookieHeader(response);

        // HttpOnly: script must not be able to read it — it is a media key, and the SPA never needs
        // to see it because the browser attaches it by itself.
        cookie.ShouldContain("httponly", Case.Insensitive);

        // Secure: it travels to a different host over the public internet.
        cookie.ShouldContain("secure", Case.Insensitive);

        // Lax, not None. vms.myceo.ir → cam.myceo.ir is same-site, so Lax is sent; None would hand
        // the cookie to any third-party page that embedded a stream URL.
        cookie.ShouldContain("samesite=lax", Case.Insensitive);

        cookie.ShouldContain("path=/", Case.Insensitive);
    }

    [Test]
    public async Task The_session_reports_when_it_expires_so_the_panel_can_renew_it()
    {
        using var client = AsAdmin();

        var dto = await (await client.PostAsync(SessionPath, null)).Content
            .ReadFromJsonAsync<Web.Endpoints.Vms.VmsMedia.VmsMediaSessionDto>();

        dto.ShouldNotBeNull();
        dto!.TtlSeconds.ShouldBeGreaterThan(0);
        dto.ExpiresAtUtc.ShouldBeGreaterThan(DateTimeOffset.UtcNow);
    }

    // ── the forwardAuth answer ───────────────────────────────────────────────

    [Test]
    public async Task Without_a_cookie_the_gateway_is_told_to_refuse()
    {
        using var client = _factory.CreateClient();

        // This is step 5's criterion. Traefik treats any non-2xx as "deny", so this single status
        // is what stops an unauthenticated stream request reaching go2rtc.
        (await client.GetAsync(CheckPath)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Test]
    public async Task A_bearer_token_alone_is_not_enough_for_the_gateway()
    {
        using var client = AsAdmin();

        // Deliberate: the check reads the cookie and nothing else. Traefik forwards a browser's
        // headers, and a browser cannot put a bearer token on a <video> request — so accepting one
        // here would test a path that can never happen and hide that the cookie was broken.
        (await client.GetAsync(CheckPath)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Test]
    public async Task With_the_cookie_the_gateway_is_told_to_allow()
    {
        using var admin = AsAdmin();
        var pair = CookiePair(await admin.PostAsync(SessionPath, null));

        // A fresh anonymous client carrying only the cookie — exactly what Traefik forwards.
        using var gateway = _factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, CheckPath);
        request.Headers.Add("Cookie", pair);

        (await gateway.SendAsync(request)).StatusCode.ShouldBe(HttpStatusCode.NoContent);
    }

    [Test]
    public async Task A_tampered_cookie_is_refused()
    {
        using var admin = AsAdmin();
        var pair = CookiePair(await admin.PostAsync(SessionPath, null));

        // Flip the last character of the signature.
        var last = pair[^1];
        var tampered = pair[..^1] + (last == 'A' ? 'B' : 'A');

        using var gateway = _factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, CheckPath);
        request.Headers.Add("Cookie", tampered);

        (await gateway.SendAsync(request)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    [Test]
    public async Task A_cookie_from_another_service_is_refused()
    {
        using var gateway = _factory.CreateClient();
        var request = new HttpRequestMessage(HttpMethod.Get, CheckPath);
        request.Headers.Add("Cookie", "vms_media=someone-elses-value");

        (await gateway.SendAsync(request)).StatusCode.ShouldBe(HttpStatusCode.Unauthorized);
    }

    // ── ending it ────────────────────────────────────────────────────────────

    [Test]
    public async Task Ending_the_session_expires_the_cookie_in_the_browser()
    {
        using var admin = AsAdmin();
        await admin.PostAsync(SessionPath, null);

        var response = await admin.DeleteAsync(SessionPath);
        response.StatusCode.ShouldBe(HttpStatusCode.NoContent);

        // Signing out of the panel must not leave a working media key behind. The browser drops it
        // because the replacement is already expired.
        var cookie = SetCookieHeader(response);
        cookie.ShouldContain("expires=", Case.Insensitive);
        cookie.ShouldStartWith("vms_media=;");
    }
}
