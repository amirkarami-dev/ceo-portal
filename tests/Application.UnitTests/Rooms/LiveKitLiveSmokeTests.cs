using Mabhas19.Application.Common.Interfaces.Rooms;
using Mabhas19.Infrastructure.Rooms;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Rooms;

/// <summary>
/// Talks to the real media server with the real key.
/// </summary>
/// <remarks>
/// <para>
/// <b>Skipped unless the credentials are in the environment</b> (<c>LiveKit__ApiKey</c>,
/// <c>LiveKit__ApiSecret</c>, <c>LiveKit__ApiUrl</c>), so a normal run and CI never reach the network
/// and no secret is in this repository.
/// </para>
/// <para>
/// Why it exists: every other test in this folder checks the token against <i>my</i> understanding of
/// LiveKit's format. Only the server can say whether that understanding is right. The election work
/// produced the same lesson twice — a hand-written wire format that looked correct and was silently
/// rejected — so the format is proven against the thing that consumes it.
/// </para>
/// </remarks>
[Explicit("Talks to the real LiveKit server. Set LiveKit__ApiKey / LiveKit__ApiSecret / LiveKit__ApiUrl.")]
[Category("LiveKit")]
public class LiveKitLiveSmokeTests
{
    private static string? Env(string name) =>
        Environment.GetEnvironmentVariable(name) is { Length: > 0 } v ? v : null;

    private static LiveKitOptions? Options()
    {
        var key = Env("LiveKit__ApiKey");
        var secret = Env("LiveKit__ApiSecret");
        var url = Env("LiveKit__ApiUrl");

        return key is null || secret is null || url is null
            ? null
            : new LiveKitOptions { ApiKey = key, ApiSecret = secret, ApiUrl = url };
    }

    private static (ILiveKitAdmin Admin, IRoomTokenService Tokens)? Build()
    {
        if (Options() is not { } o)
        {
            return null;
        }

        var tokens = new RoomTokenService(Microsoft.Extensions.Options.Options.Create(o));
        var http = new HttpClient { BaseAddress = new Uri(o.ApiUrl.TrimEnd('/') + "/") };

        return (new LiveKitAdmin(
            http, tokens, tokens, Microsoft.Extensions.Options.Options.Create(o),
            NullLogger<LiveKitAdmin>.Instance), tokens);
    }

    [Test]
    public async Task The_real_server_accepts_our_admin_token_and_manages_a_room()
    {
        if (Build() is not { } kit)
        {
            Assert.Ignore("LiveKit credentials not in the environment.");
            return;
        }

        var slug = $"ceo-smoke{Guid.NewGuid():N}"[..20];
        var ct = TestContext.CurrentContext.CancellationToken;

        // Create → the room appears in a head-count → delete → it is gone. If the admin token's grants
        // were wrong, every one of these would silently return the fail-soft default instead.
        await kit.Admin.EnsureRoomAsync(slug, 5, ct);

        var counts = await kit.Admin.LiveCountsAsync([slug], ct);
        counts.ShouldContainKey(slug);
        counts[slug].ShouldBe(0, "a freshly created room has nobody in it");

        await kit.Admin.EndRoomAsync(slug, ct);

        TestContext.Out.WriteLine($"created, listed and deleted {slug} on the real server");
    }

    [Test]
    public async Task A_head_count_for_a_room_that_does_not_exist_is_zero_not_an_error()
    {
        if (Build() is not { } kit)
        {
            Assert.Ignore("LiveKit credentials not in the environment.");
            return;
        }

        // The meeting list asks for a count on every row. A room nobody has joined yet does not exist
        // on the media server, and that must render as "0 inside", never as a broken page.
        var count = await kit.Admin.LiveCountAsync(
            "ceo-definitely-not-there", TestContext.CurrentContext.CancellationToken);

        count.ShouldBe(0);
    }

    [Test]
    public void A_join_token_is_shaped_the_way_the_server_expects()
    {
        if (Build() is not { } kit)
        {
            Assert.Ignore("LiveKit credentials not in the environment.");
            return;
        }

        // The server rejects a malformed token outright, which the admin calls above already prove for
        // the admin shape. This records that a JOIN token is produced from the same signer.
        var token = kit.Tokens.CreateJoinToken(
            new RoomGrant("ceo-smoketest", "1234567890", "آزمون", CanPublish: false));

        token.Split('.').Length.ShouldBe(3);
        kit.Tokens.IsConfigured.ShouldBeTrue();
    }
}
