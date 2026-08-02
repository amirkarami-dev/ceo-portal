using System.Text;
using Mabhas19.Application.Vms;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Vms;

/// <summary>
/// The signed cookie the media gateway trusts.
/// </summary>
/// <remarks>
/// This token is the only thing standing between the public internet and a wall of live cameras, and
/// it is checked by a machine with no other way to know who is asking. Every way it can be wrong is
/// worth a test.
/// </remarks>
public class VmsMediaTokenTests
{
    private static readonly byte[] Key = Encoding.UTF8.GetBytes("a-test-signing-key-32-bytes-long");
    private static readonly byte[] OtherKey = Encoding.UTF8.GetBytes("a-DIFFERENT-key-32-bytes-long!!!");

    private static readonly DateTimeOffset Now = new(2026, 8, 2, 12, 0, 0, TimeSpan.Zero);

    [Test]
    public void A_freshly_issued_token_verifies_and_carries_its_subject()
    {
        var token = VmsMediaToken.Issue("user-42", Now.AddMinutes(60), Key);

        var payload = VmsMediaToken.Verify(token, Key, Now);

        payload.ShouldNotBeNull();
        payload!.Subject.ShouldBe("user-42");
        payload.ExpiresAt.ShouldBe(Now.AddMinutes(60));
    }

    [Test]
    public void A_token_signed_with_another_key_is_refused()
        => VmsMediaToken.Verify(VmsMediaToken.Issue("user-42", Now.AddMinutes(60), OtherKey), Key, Now)
            .ShouldBeNull();

    [Test]
    public void An_expired_token_is_refused()
        => VmsMediaToken.Verify(VmsMediaToken.Issue("user-42", Now.AddMinutes(-1), Key), Key, Now)
            .ShouldBeNull();

    [Test]
    public void A_token_expiring_exactly_now_is_refused()
        => VmsMediaToken.Verify(VmsMediaToken.Issue("user-42", Now, Key), Key, Now).ShouldBeNull();

    [Test]
    public void Editing_the_expiry_invalidates_the_signature()
    {
        var token = VmsMediaToken.Issue("user-42", Now.AddMinutes(-5), Key);
        var forged = VmsMediaToken.Issue("user-42", Now.AddYears(10), Key);

        // Splice a far-future body onto the old signature: the obvious forgery, and the reason the
        // expiry is inside the signed payload rather than beside it.
        var spliced = forged.Split('.')[0] + "." + token.Split('.')[1];

        VmsMediaToken.Verify(spliced, Key, Now).ShouldBeNull();
    }

    [TestCase("")]
    [TestCase("   ")]
    [TestCase("not-a-token")]
    [TestCase("only.two")]
    [TestCase("a.b.c")]
    [TestCase(".")]
    [TestCase("....")]
    [TestCase("!!!!.!!!!")]
    public void Rubbish_is_refused_without_throwing(string token)
        => VmsMediaToken.Verify(token, Key, Now).ShouldBeNull();

    [Test]
    public void A_null_token_is_refused()
        => VmsMediaToken.Verify(null, Key, Now).ShouldBeNull();

    [Test]
    public void No_key_means_nothing_verifies_even_a_genuine_token()
    {
        // Fail closed. An unconfigured deployment must refuse everyone rather than accept anyone.
        var token = VmsMediaToken.Issue("user-42", Now.AddMinutes(60), Key);

        VmsMediaToken.Verify(token, [], Now).ShouldBeNull();
    }

    [Test]
    public void A_subject_containing_dots_survives_the_round_trip()
    {
        // The payload is joined with dots and split with a limit of three, so a subject with dots in
        // it stays whole. OIDC subjects are opaque and this one is cheap to get wrong.
        var token = VmsMediaToken.Issue("a.b.c.d", Now.AddMinutes(5), Key);

        VmsMediaToken.Verify(token, Key, Now)!.Subject.ShouldBe("a.b.c.d");
    }

    // ── the options fail closed ──────────────────────────────────────────────

    [Test]
    public void An_unset_secret_leaves_the_feature_unconfigured()
        => new VmsMediaOptions { TokenSecret = "" }.IsConfigured.ShouldBeFalse();

    [Test]
    public void A_base64_secret_is_decoded_to_its_bytes()
    {
        var secret = Convert.ToBase64String(new byte[32]);

        new VmsMediaOptions { TokenSecret = secret }.Key.Length.ShouldBe(32);
    }

    [Test]
    public void A_secret_that_is_not_base64_is_used_as_text_rather_than_silently_ignored()
    {
        // Somebody will put a passphrase there. Better a working key of their bytes than an empty
        // one that turns the whole feature off with no message.
        new VmsMediaOptions { TokenSecret = "not base64 at all" }.Key.Length.ShouldBeGreaterThan(0);
    }
}
