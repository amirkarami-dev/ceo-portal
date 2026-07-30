using Mabhas19.Infrastructure.Elections;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Elections;

/// <summary>
/// Sends ONE real Bale message to a real phone, through the real <see cref="BaleSafirSender"/>.
/// </summary>
/// <remarks>
/// <para>
/// <b>Skipped unless three environment variables are set</b>, so a normal test run — and CI — never
/// touches Bale and never messages anybody:
/// </para>
/// <list type="bullet">
/// <item><c>BALE_SAFIR_ACCESS_KEY</c> — the <c>api-access-key</c> from the safir dashboard</item>
/// <item><c>BALE_SAFIR_BOT_ID</c> — the numeric <c>bot_id</c> from the same page</item>
/// <item><c>BALE_TEST_PHONE</c> — the number to message, in any form the org DB uses</item>
/// </list>
/// <para>
/// Read from the environment rather than written into this file on purpose: the key is a credential and
/// the phone is personal data, and neither belongs in a repository. It also means the same test works for
/// whoever runs it, against whichever bot they own.
/// </para>
/// <para>
/// This is the one thing the whole Bale channel could not otherwise prove. Everything else about the bot
/// is covered by tests against fakes; whether safir accepts <i>this</i> body, with <i>this</i> key, for
/// <i>this</i> bot, can only be learned by asking safir. A failure here is invisible in production —
/// <c>ViaBale</c> comes back false, the voter is told the code went by SMS, and nothing looks broken.
/// </para>
/// </remarks>
[Explicit("Sends a real Bale message. Set BALE_SAFIR_ACCESS_KEY, BALE_SAFIR_BOT_ID and BALE_TEST_PHONE.")]
[Category("LiveBale")]
public class SafirLiveSmokeTests
{
    private static string? Env(string name) =>
        Environment.GetEnvironmentVariable(name) is { Length: > 0 } v ? v : null;

    [Test]
    public async Task Safir_accepts_a_message_for_the_configured_phone()
    {
        var key = Env("BALE_SAFIR_ACCESS_KEY");
        var botId = Env("BALE_SAFIR_BOT_ID");
        var phone = Env("BALE_TEST_PHONE");

        if (key is null || botId is null || phone is null)
        {
            Assert.Ignore(
                "Set BALE_SAFIR_ACCESS_KEY, BALE_SAFIR_BOT_ID and BALE_TEST_PHONE to run this.");
            return;
        }

        // Prove the number normalises before spending a real send on it.
        var target = BaleSafirSender.ToSafirPhone(phone);
        target.ShouldNotBeNull("The phone did not normalise to an Iranian mobile.");
        TestContext.Out.WriteLine($"normalised -> {target}");

        var options = Options.Create(new BaleOptions
        {
            SafirAccessKey = key,
            SafirBotId = long.Parse(botId)
        });

        using var http = new HttpClient { BaseAddress = new Uri("https://safir.bale.ai/") };
        var sender = new BaleSafirSender(http, options, NullLogger<BaleSafirSender>.Instance);

        // Wording deliberately unlike a real code, so nobody mistakes this for a live vote prompt.
        var sent = await sender.SendAsync(
            phone,
            "پیام آزمایشی سامانه انتخابات نظام مهندسی. این یک کد تأیید نیست.",
            TestContext.CurrentContext.CancellationToken);

        TestContext.Out.WriteLine(sent
            ? "safir ACCEPTED the message — check the phone for a Bale message."
            : "safir REFUSED. The key, the bot_id, or the account state is wrong.");

        sent.ShouldBeTrue(
            "safir refused the request. In production this is silent: the Bale channel reports " +
            "'not delivered' and SMS carries every code.");
    }
}
