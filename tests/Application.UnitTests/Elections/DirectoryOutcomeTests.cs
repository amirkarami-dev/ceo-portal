using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Elections;
using Mabhas19.Domain.Elections;
using Mabhas19.Infrastructure.Elections;
using Microsoft.Extensions.Options;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Elections;

/// <summary>
/// Regressions for the three HIGH findings from the adversarial review of the cast path. Each of these
/// failed silently before, which is why they get their own tests rather than a comment.
/// </summary>
public class DirectoryOutcomeTests
{
    private static readonly DateOnly Today = new(2026, 7, 23);

    private static Election Election() => new()
    {
        Status = ElectionStatus.Published,
        EligibilityMode = ElectionEligibility.AllMembers,
        DateJalali = "1405/05/01"
    };

    [Test]
    public void An_outage_produces_a_different_message_than_an_unknown_code()
    {
        // The bug: the directory swallowed every exception and returned null, so the outage branch was
        // UNREACHABLE and every voter was told «این کد ملی یافت نشد» during a database outage — the
        // exact wording GOTCHAS records being wrongly shown once before for a SQL parameter bug.
        var unavailable = VoterEligibility.CheckVoter(Election(), null, Today, lookupFailed: true);
        var notFound = VoterEligibility.CheckVoter(Election(), null, Today, lookupFailed: false);

        unavailable.Status.ShouldBe(VoterStatus.DirectoryUnavailable);
        notFound.Status.ShouldBe(VoterStatus.NotAMember);
        unavailable.Message.ShouldNotBe(notFound.Message);
        unavailable.Message.ShouldNotContain("یافت نشد");
    }

    [Test]
    public void DirectoryResult_reports_found_only_with_an_engineer_attached()
    {
        // Guards against a result that claims Found while carrying null, which would NRE downstream.
        new DirectoryResult(DirectoryOutcome.Found, null).IsFound.ShouldBeFalse();
        new DirectoryResult(DirectoryOutcome.NotFound, null).IsFound.ShouldBeFalse();
        new DirectoryResult(DirectoryOutcome.Unavailable, null).IsFound.ShouldBeFalse();

        var info = new EngineerInfo("1234567890", "علی", "کریمی", "4", null, 0, "1406/05/01");
        new DirectoryResult(DirectoryOutcome.Found, info).IsFound.ShouldBeTrue();
    }
}

public class RollFingerprintTests
{
    private const string PepperA = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
    private const string PepperB = "Hx4dHBsaGRgXFhUUExIREA8ODQwLCgkIBwYFBAMCAQA=";

    private static VoterRoll Roll(string pepper) =>
        new(Options.Create(new ElectionCryptoOptions { VoterPepper = pepper }));

    [Test]
    public void The_fingerprint_is_8_bytes_and_stable()
    {
        var a = Roll(PepperA);
        a.Fingerprint.Length.ShouldBe(8);
        a.Fingerprint.ShouldBe(Roll(PepperA).Fingerprint);
    }

    [Test]
    public void A_changed_pepper_changes_the_fingerprint()
    {
        // This is what lets the cast REFUSE after a pepper change instead of silently handing the same
        // person a second vote under a new hash.
        Roll(PepperA).Fingerprint.ShouldNotBe(Roll(PepperB).Fingerprint);
    }

    [Test]
    public void A_changed_pepper_really_does_void_the_one_vote_key()
    {
        // The underlying danger, stated as a test: same election, same person, two peppers, two
        // different hashes — so the UNIQUE key on (ElectionId, VoterHash) would not fire.
        var a = Roll(PepperA).ComputeHash(7, "1234567890");
        var b = Roll(PepperB).ComputeHash(7, "1234567890");

        a.ShouldNotBe(b);
    }

    [Test]
    public void The_fingerprint_reveals_nothing_derived_from_a_voter()
    {
        // It must be a fixed label only. If a کد ملی ever leaked into it, a non-secret column on the
        // election row would carry voter-derived material.
        var roll = Roll(PepperA);
        var fp = roll.Fingerprint;

        foreach (var code in new[] { "1234567890", "0987654321" })
        {
            roll.ComputeHash(7, code).Take(8).ShouldNotBe(fp);
        }
    }

    [Test]
    public void An_unconfigured_pepper_has_an_empty_fingerprint()
        => Roll("").Fingerprint.ShouldBeEmpty();
}

/// <summary>
/// The one-vote guarantee, at the level the code actually relies on: identical input must produce an
/// identical key. The database-level proof (duplicate insert rejected with error 2627) was run against
/// SQL Server in step 1; these cover the hash that feeds it.
/// </summary>
public class OneVoteKeyTests
{
    private const string Pepper = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";

    private static VoterRoll Roll() =>
        new(Options.Create(new ElectionCryptoOptions { VoterPepper = Pepper }));

    [TestCase("1234567890", "۱۲۳۴۵۶۷۸۹۰")]
    [TestCase("1234567890", " 1234567890 ")]
    [TestCase("1234567890", "١٢٣٤٥٦٧٨٩٠")]
    public void Every_form_of_one_code_yields_the_same_key(string latin, string other)
    {
        // Each of these is a channel difference that would otherwise let one person vote twice: the
        // web sends Latin, the Bale bot will send Persian from a fa keyboard, and Arabic-Indic digits
        // arrive from some keyboards too.
        var r = Roll();
        r.ComputeHash(7, other).ShouldBe(r.ComputeHash(7, latin));
    }

    [Test]
    public void Two_different_people_never_share_a_key()
    {
        var r = Roll();
        r.ComputeHash(7, "1234567890").ShouldNotBe(r.ComputeHash(7, "1234567891"));
    }
}
