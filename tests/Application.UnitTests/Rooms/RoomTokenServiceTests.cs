using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Mabhas19.Application.Common.Interfaces.Rooms;
using Mabhas19.Infrastructure.Rooms;
using Microsoft.Extensions.Options;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Rooms;

/// <summary>
/// The join token — the only thing that lets somebody into a meeting, and the only thing that decides
/// whether they may speak.
/// </summary>
/// <remarks>
/// These tests read the token's actual bytes rather than trusting the object that produced it. The
/// failure being guarded against is silent: LiveKit treats an <b>omitted</b> <c>canPublish</c> as
/// <c>true</c>, so an audience token that merely forgets to write <c>false</c> hands a microphone to
/// every viewer of a public presentation, and nothing anywhere reports an error.
/// </remarks>
public class RoomTokenServiceTests
{
    private const string Key = "ceo-test-key";
    private const string Secret = "a-test-secret-long-enough-to-be-realistic";

    private static RoomTokenService Service(string key = Key, string secret = Secret) =>
        new(Options.Create(new LiveKitOptions
        {
            ApiUrl = "https://lk.example.test",
            ApiKey = key,
            ApiSecret = secret,
            PublicWsUrl = "wss://lk.example.test",
        }));

    /// <summary>Decodes a JWT segment without verifying — the tests verify separately.</summary>
    private static JsonElement Part(string token, int index)
    {
        var seg = token.Split('.')[index].Replace('-', '+').Replace('_', '/');
        seg = seg.PadRight(seg.Length + ((4 - (seg.Length % 4)) % 4), '=');
        return JsonDocument.Parse(Convert.FromBase64String(seg)).RootElement;
    }

    private static string RawPayload(string token)
    {
        var seg = token.Split('.')[1].Replace('-', '+').Replace('_', '/');
        seg = seg.PadRight(seg.Length + ((4 - (seg.Length % 4)) % 4), '=');
        return Encoding.UTF8.GetString(Convert.FromBase64String(seg));
    }

    private static RoomGrant Audience(string room = "ceo-abc123") =>
        new(room, "guest-xyz", "مهمان", CanPublish: false);

    private static RoomGrant Presenter(string room = "ceo-abc123") =>
        new(room, "1234567890", "ارائه‌دهنده", CanPublish: true);

    // ── the difference that matters ──────────────────────────────────────────

    [Test]
    public void An_audience_token_says_canPublish_false_IN_THE_JSON()
    {
        // Not "the object had false" — the bytes. An omitted field means ALLOWED to LiveKit.
        var raw = RawPayload(Service().CreateJoinToken(Audience()));

        raw.ShouldContain("\"canPublish\":false");
        raw.ShouldNotContain("\"canPublish\":true");
    }

    [Test]
    public void A_presenter_token_says_canPublish_true()
        => RawPayload(Service().CreateJoinToken(Presenter())).ShouldContain("\"canPublish\":true");

    [Test]
    public void The_two_tokens_differ_only_where_they_should()
    {
        var audience = Part(Service().CreateJoinToken(Audience()), 1).GetProperty("video");
        var presenter = Part(Service().CreateJoinToken(Presenter()), 1).GetProperty("video");

        audience.GetProperty("canPublish").GetBoolean().ShouldBeFalse();
        presenter.GetProperty("canPublish").GetBoolean().ShouldBeTrue();

        // Both still watch, listen and chat — an audience is muted, not cut off.
        audience.GetProperty("canSubscribe").GetBoolean().ShouldBeTrue();
        audience.GetProperty("canPublishData").GetBoolean().ShouldBeTrue();
        audience.GetProperty("roomJoin").GetBoolean().ShouldBeTrue();
    }

    // ── scope ────────────────────────────────────────────────────────────────

    [Test]
    public void A_join_token_is_valid_for_exactly_one_room()
    {
        var video = Part(Service().CreateJoinToken(Audience("ceo-only-this")), 1).GetProperty("video");

        video.GetProperty("room").GetString().ShouldBe("ceo-only-this");
    }

    [Test]
    public void A_join_token_carries_no_admin_rights()
    {
        // A participant token that could end a meeting would let a presenter's browser be tricked
        // into ending it. Those actions go through the API, where the caller is checked.
        var video = Part(Service().CreateJoinToken(Presenter()), 1).GetProperty("video");

        video.TryGetProperty("roomAdmin", out _).ShouldBeFalse();
        video.TryGetProperty("roomCreate", out _).ShouldBeFalse();
        video.TryGetProperty("roomList", out _).ShouldBeFalse();
    }

    [Test]
    public void A_grant_with_no_room_is_refused()
    {
        // A token with no room name is valid for EVERY room on the server.
        Should.Throw<ArgumentException>(
            () => Service().CreateJoinToken(new RoomGrant("", "id", "name", CanPublish: false)));

        Should.Throw<ArgumentException>(
            () => Service().CreateJoinToken(new RoomGrant("ceo-x", "", "name", CanPublish: false)));
    }

    // ── signature ────────────────────────────────────────────────────────────

    [Test]
    public void The_signature_verifies_against_the_api_secret()
    {
        var token = Service().CreateJoinToken(Presenter());
        var parts = token.Split('.');

        var expected = Convert.ToBase64String(
                HMACSHA256.HashData(
                    Encoding.UTF8.GetBytes(Secret),
                    Encoding.UTF8.GetBytes($"{parts[0]}.{parts[1]}")))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');

        parts[2].ShouldBe(expected);
    }

    [Test]
    public void A_different_secret_produces_a_different_signature()
    {
        var a = Service().CreateJoinToken(Presenter());
        var b = Service(secret: "a-completely-different-secret-value!!").CreateJoinToken(Presenter());

        a.Split('.')[2].ShouldNotBe(b.Split('.')[2]);
    }

    [Test]
    public void The_header_is_HS256()
    {
        var head = Part(Service().CreateJoinToken(Presenter()), 0);

        head.GetProperty("alg").GetString().ShouldBe("HS256");
        head.GetProperty("typ").GetString().ShouldBe("JWT");
    }

    [Test]
    public void The_token_is_base64url_with_no_padding()
    {
        // Plain base64 is rejected by every JWT parser: '+' and '/' are not URL-safe and '=' is not
        // allowed in a segment.
        var token = Service().CreateJoinToken(Presenter());

        token.ShouldNotContain("=");
        token.ShouldNotContain("+");
        token.ShouldNotContain("/");
        token.Split('.').Length.ShouldBe(3);
    }

    // ── lifetime and identity ────────────────────────────────────────────────

    [Test]
    public void The_issuer_is_the_api_key_and_the_subject_is_the_participant()
    {
        var body = Part(Service().CreateJoinToken(Presenter()), 1);

        body.GetProperty("iss").GetString().ShouldBe(Key);
        body.GetProperty("sub").GetString().ShouldBe("1234567890");
        body.GetProperty("name").GetString().ShouldBe("ارائه‌دهنده");
    }

    [Test]
    public void Not_before_is_slightly_in_the_past()
    {
        // The media server is a different machine. A token stamped one second in its future is
        // rejected outright, so a few seconds of leeway is the difference between joining and not.
        var body = Part(Service().CreateJoinToken(Presenter()), 1);
        var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        body.GetProperty("nbf").GetInt64().ShouldBeLessThan(now + 1);
    }

    [Test]
    public void The_default_lifetime_covers_a_long_meeting_and_a_reconnect()
    {
        var body = Part(Service().CreateJoinToken(Presenter()), 1);
        var hours = (body.GetProperty("exp").GetInt64() - DateTimeOffset.UtcNow.ToUnixTimeSeconds()) / 3600.0;

        hours.ShouldBeGreaterThan(5.9);
        hours.ShouldBeLessThan(6.1);
    }

    [Test]
    public void A_short_ttl_is_honoured()
    {
        var body = Part(Service().CreateJoinToken(Presenter(), TimeSpan.FromMinutes(2)), 1);
        var seconds = body.GetProperty("exp").GetInt64() - DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        seconds.ShouldBeInRange(100, 125);
    }

    // ── unconfigured ─────────────────────────────────────────────────────────

    [Test]
    public void With_no_secret_the_service_reports_unconfigured_and_refuses_to_sign()
    {
        var service = Service(secret: "");

        service.IsConfigured.ShouldBeFalse();

        // A token signed with an empty secret is one anybody reading the source could forge, so this
        // must throw rather than produce something that looks valid.
        Should.Throw<InvalidOperationException>(() => service.CreateJoinToken(Presenter()));
    }

    [Test]
    public void With_a_key_and_secret_it_reports_configured()
        => Service().IsConfigured.ShouldBeTrue();

    // ── the admin token ──────────────────────────────────────────────────────

    [Test]
    public void The_admin_token_carries_the_server_wide_grants_a_join_token_never_does()
    {
        var video = Part(Service().CreateAdminToken(TimeSpan.FromMinutes(2)), 1).GetProperty("video");

        video.GetProperty("roomAdmin").GetBoolean().ShouldBeTrue();
        video.GetProperty("roomCreate").GetBoolean().ShouldBeTrue();
        video.GetProperty("roomList").GetBoolean().ShouldBeTrue();

        // No room, and no join: it manages rooms, it does not enter one.
        video.TryGetProperty("room", out _).ShouldBeFalse();
        video.TryGetProperty("roomJoin", out _).ShouldBeFalse();
    }

    [Test]
    public void The_admin_token_is_short_lived()
    {
        var body = Part(Service().CreateAdminToken(TimeSpan.FromMinutes(2)), 1);
        var seconds = body.GetProperty("exp").GetInt64() - DateTimeOffset.UtcNow.ToUnixTimeSeconds();

        // A captured admin token must not be a lasting key to every meeting on the server.
        seconds.ShouldBeLessThan(200);
    }
}
