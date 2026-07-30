using System.Security.Cryptography;
using Mabhas19.Infrastructure.Elections;
using Microsoft.Extensions.Options;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Elections;

/// <summary>
/// The secret ballot's crypto core. These tests assert the SECRECY properties, not just that
/// encryption round-trips — a sealer that round-trips perfectly can still leak the choice through
/// ciphertext length or slot order.
/// </summary>
public class BallotSealerTests
{
    // Test-only keys. Real ones come from deploy/.env and are never in the repo.
    private const string Key = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";

    private static BallotSealer Sealer(string key = Key) =>
        new(Options.Create(new ElectionCryptoOptions { BallotMasterKey = key }));

    [Test]
    public void Seal_then_Open_returns_the_same_candidates()
    {
        var s = Sealer();
        var blob = s.Seal(electionId: 7, keyVersion: 1, maxSelections: 3, [42, 17, 99]);

        s.Open(7, 1, 3, blob).ShouldBe(new[] { 17, 42, 99 });
    }

    [Test]
    public void Ciphertext_length_does_not_reveal_how_many_were_picked()
    {
        // The whole point of padding. If these differed, anyone reading the table could tell a
        // one-candidate voter from a three-candidate voter without any key at all.
        var s = Sealer();

        var one = s.Seal(7, 1, 5, [3]);
        var five = s.Seal(7, 1, 5, [1, 2, 3, 4, 5]);

        one.Length.ShouldBe(five.Length);
    }

    [Test]
    public void Click_order_is_destroyed()
    {
        // Slots are sorted before sealing, so the order the voter clicked cannot become a fingerprint.
        var s = Sealer();

        s.Open(7, 1, 3, s.Seal(7, 1, 3, [99, 17, 42]))
            .ShouldBe(s.Open(7, 1, 3, s.Seal(7, 1, 3, [17, 42, 99])));
    }

    [Test]
    public void The_same_vote_seals_differently_every_time()
    {
        // A fresh random nonce per ballot. Without it, identical votes would produce identical
        // ciphertext and the tally would be readable by grouping duplicates.
        var s = Sealer();

        var a = s.Seal(7, 1, 2, [5]);
        var b = s.Seal(7, 1, 2, [5]);

        a.ShouldNotBe(b);
    }

    [Test]
    public void A_ballot_cannot_be_moved_to_another_election()
    {
        // The election id is both HKDF info and GCM additional data, so a blob replayed into a
        // different election fails to authenticate instead of quietly counting there.
        var s = Sealer();
        var blob = s.Seal(electionId: 7, keyVersion: 1, maxSelections: 2, [5]);

        Should.Throw<CryptographicException>(() => s.Open(8, 1, 2, blob));
    }

    [Test]
    public void A_wrong_key_version_will_not_open_it()
    {
        var s = Sealer();
        var blob = s.Seal(7, keyVersion: 1, maxSelections: 2, [5]);

        Should.Throw<CryptographicException>(() => s.Open(7, 2, 2, blob));
    }

    [Test]
    public void Tampering_with_a_single_byte_is_detected()
    {
        // GCM authenticates. A silently-accepted edit would let someone rewrite votes in the database.
        var s = Sealer();
        var blob = s.Seal(7, 1, 2, [5]);
        blob[^1] ^= 0xFF;

        Should.Throw<CryptographicException>(() => s.Open(7, 1, 2, blob));
    }

    [Test]
    public void A_different_master_key_cannot_open_it()
    {
        var blob = Sealer().Seal(7, 1, 2, [5]);
        var other = Sealer("Hx4dHBsaGRgXFhUUExIREA8ODQwLCgkIBwYFBAMCAQA=");

        Should.Throw<CryptographicException>(() => other.Open(7, 1, 2, blob));
    }

    [Test]
    public void A_truncated_blob_is_rejected_before_decryption()
    {
        var s = Sealer();
        var blob = s.Seal(7, 1, 3, [5]);

        Should.Throw<CryptographicException>(() => s.Open(7, 1, 3, blob[..^4]));
    }

    [Test]
    public void A_blank_ballot_is_refused()
    {
        // It would count as a vote and tally to nothing — indistinguishable from a tally bug.
        Should.Throw<ArgumentException>(() => Sealer().Seal(7, 1, 3, []));
    }

    [Test]
    public void Voting_twice_for_one_candidate_is_refused()
        => Should.Throw<ArgumentException>(() => Sealer().Seal(7, 1, 3, [5, 5]));

    [Test]
    public void Picking_more_than_allowed_is_refused()
        => Should.Throw<ArgumentException>(() => Sealer().Seal(7, 1, 2, [1, 2, 3]));

    [Test]
    public void Candidate_id_zero_is_refused_because_zero_is_the_padding()
        => Should.Throw<ArgumentException>(() => Sealer().Seal(7, 1, 3, [0]));

    [Test]
    public void A_missing_key_makes_voting_unavailable_rather_than_unsafe()
    {
        var s = Sealer(key: "");

        s.IsConfigured.ShouldBeFalse();
        Should.Throw<InvalidOperationException>(() => s.Seal(7, 1, 1, [5]));
    }

    [Test]
    public void A_short_key_is_rejected_at_startup()
    {
        // A 16-byte key looks configured but is weaker than intended. Better to fail on boot than to
        // discover it after a real election.
        Should.Throw<InvalidOperationException>(() => Sealer("AAECAwQFBgcICQoLDA0ODw=="));
    }
}

public class VoterRollTests
{
    private const string Pepper = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";

    private static VoterRoll Roll(string pepper = Pepper) =>
        new(Options.Create(new ElectionCryptoOptions { VoterPepper = pepper }));

    [Test]
    public void The_hash_is_32_bytes()
        => Roll().ComputeHash(1, "1234567890").Length.ShouldBe(32);

    [Test]
    public void The_same_person_in_the_same_election_always_hashes_the_same()
    {
        // This is what the UNIQUE key relies on to stop a second vote.
        var r = Roll();
        r.ComputeHash(1, "1234567890").ShouldBe(r.ComputeHash(1, "1234567890"));
    }

    [Test]
    public void Persian_digits_hash_the_same_as_Latin_digits()
    {
        // Load-bearing: the bot receives Persian digits from a fa keyboard, the web sends Latin. If
        // these differed, the same person would vote once through each channel.
        var r = Roll();
        r.ComputeHash(1, "۱۲۳۴۵۶۷۸۹۰").ShouldBe(r.ComputeHash(1, "1234567890"));
    }

    [Test]
    public void Surrounding_whitespace_does_not_change_the_hash()
    {
        var r = Roll();
        r.ComputeHash(1, "  1234567890  ").ShouldBe(r.ComputeHash(1, "1234567890"));
    }

    [Test]
    public void A_leading_zero_code_survives_intact()
    {
        // Parsing the code as a number would turn 0012345678 into 12345678 and collide two people.
        var r = Roll();
        r.ComputeHash(1, "0012345678").ShouldNotBe(r.ComputeHash(1, "0123456780"));
    }

    [Test]
    public void The_same_person_hashes_differently_in_different_elections()
    {
        // Per-election scoping. Otherwise anyone holding the pepper could follow one voter across
        // every election they ever took part in.
        var r = Roll();
        r.ComputeHash(1, "1234567890").ShouldNotBe(r.ComputeHash(2, "1234567890"));
    }

    [Test]
    public void A_different_pepper_gives_a_different_hash()
    {
        var a = Roll().ComputeHash(1, "1234567890");
        var b = Roll("Hx4dHBsaGRgXFhUUExIREA8ODQwLCgkIBwYFBAMCAQA=").ComputeHash(1, "1234567890");

        a.ShouldNotBe(b);
    }

    [TestCase("123")]
    [TestCase("12345678901")]
    [TestCase("123456789a")]
    [TestCase("")]
    public void A_malformed_national_code_throws_rather_than_being_hashed(string code)
    {
        // Hashing it anyway would produce a value that does not match the same person's real hash,
        // so the UNIQUE key would not fire and they could vote twice.
        Should.Throw<ArgumentException>(() => Roll().ComputeHash(1, code));
    }

    [Test]
    public void A_missing_pepper_makes_voting_unavailable_rather_than_unsafe()
    {
        var r = Roll(pepper: "");

        r.IsConfigured.ShouldBeFalse();
        Should.Throw<InvalidOperationException>(() => r.ComputeHash(1, "1234567890"));
    }

    [Test]
    public void A_short_pepper_is_rejected_at_startup()
        => Should.Throw<InvalidOperationException>(() => Roll("AAECAwQFBgcICQoLDA0ODw=="));
}
