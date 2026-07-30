using System.Reflection;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Application.Elections;
using Mabhas19.Domain.Elections;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Elections;

public class VoterEligibilityTests
{
    private static readonly DateTimeOffset Noon = new(2026, 7, 23, 12, 0, 0, TimeSpan.Zero);
    private static readonly DateOnly Today = new(2026, 7, 23);

    private static Election Open(ElectionEligibility mode = ElectionEligibility.AllMembers, params string[] codes)
    {
        var e = new Election
        {
            Status = ElectionStatus.Published,
            OpensAtUtc = Noon.AddHours(-1),
            ClosesAtUtc = Noon.AddHours(1),
            EligibilityMode = mode,
            DateJalali = "1405/05/01",
            StartTime = new TimeOnly(9, 0),
            EndTime = new TimeOnly(17, 0)
        };
        foreach (var c in codes)
        {
            e.EligibleReshtes.Add(new ElectionEligibleReshte { ReshteCode = c, ReshteLabel = "مکانیک" });
        }
        return e;
    }

    /// <summary>Active member, licence valid a year out, mechanical engineer.</summary>
    private static EngineerInfo Engineer(
        int? status = 0,
        string? expiry = "1406/05/01",
        string reshte = "4") =>
        new("1234567890", "علی", "کریمی", reshte, "09180000000", status, expiry, "کارشناسی");

    // ── election-level ───────────────────────────────────────────────────────

    [Test]
    public void A_draft_election_is_not_votable()
    {
        var e = Open();
        e.Status = ElectionStatus.Draft;
        VoterEligibility.CheckElection(e, Noon).Status.ShouldBe(VoterStatus.NotPublished);
    }

    [Test]
    public void A_cancelled_election_is_not_votable()
    {
        var e = Open();
        e.Status = ElectionStatus.Cancelled;
        VoterEligibility.CheckElection(e, Noon).Status.ShouldBe(VoterStatus.Cancelled);
    }

    [Test]
    public void Before_the_window_the_message_names_the_start()
    {
        var e = Open();
        e.OpensAtUtc = Noon.AddHours(2);
        e.ClosesAtUtc = Noon.AddHours(3);

        var check = VoterEligibility.CheckElection(e, Noon);
        check.Status.ShouldBe(VoterStatus.NotOpenYet);
        check.Message.ShouldContain("09:00");
        check.Message.ShouldContain("1405/05/01");
    }

    [Test]
    public void After_the_window_it_is_closed()
    {
        var e = Open();
        e.ClosesAtUtc = Noon.AddHours(-1);
        VoterEligibility.CheckElection(e, Noon).Status.ShouldBe(VoterStatus.Closed);
    }

    [Test]
    public void Inside_the_window_it_is_votable()
        => VoterEligibility.CheckElection(Open(), Noon).IsEligible.ShouldBeTrue();

    // ── person-level ─────────────────────────────────────────────────────────

    [Test]
    public void An_active_member_with_a_valid_licence_may_vote()
        => VoterEligibility.CheckVoter(Open(), Engineer(), Today).IsEligible.ShouldBeTrue();

    [Test]
    public void An_unknown_national_code_is_refused()
    {
        var check = VoterEligibility.CheckVoter(Open(), null, Today);
        check.Status.ShouldBe(VoterStatus.NotAMember);
        check.Message.ShouldContain("یافت نشد");
    }

    [Test]
    public void A_directory_outage_is_NOT_reported_as_not_found()
    {
        // GOTCHAS records «این کد ملی یافت نشد» once being shown for a SQL parameter bug. If an outage
        // reused that wording, an incident would look like every engineer suddenly being ineligible.
        var check = VoterEligibility.CheckVoter(Open(), null, Today, lookupFailed: true);

        check.Status.ShouldBe(VoterStatus.DirectoryUnavailable);
        check.Message.ShouldNotContain("یافت نشد");
    }

    [TestCase(1)]
    [TestCase(2)]
    [TestCase(-1)]
    public void Only_Vazeyat_zero_counts_as_active(int status)
        => VoterEligibility.CheckVoter(Open(), Engineer(status: status), Today)
            .Status.ShouldBe(VoterStatus.NotActive);

    [Test]
    public void A_missing_membership_status_fails_closed()
    {
        // Null must not be treated as active — an incomplete record would otherwise get a vote.
        VoterEligibility.CheckVoter(Open(), Engineer(status: null), Today)
            .Status.ShouldBe(VoterStatus.NotActive);
    }

    [Test]
    public void An_expired_licence_is_refused()
        => VoterEligibility.CheckVoter(Open(), Engineer(expiry: "1404/01/01"), Today)
            .Status.ShouldBe(VoterStatus.LicenceExpired);

    [Test]
    public void A_licence_expiring_today_is_still_valid()
    {
        // 1405/05/01 is 2026-07-23. Expiry means "valid through that day", so today must pass.
        VoterEligibility.CheckVoter(Open(), Engineer(expiry: "1405/05/01"), Today)
            .IsEligible.ShouldBeTrue();
    }

    [TestCase(null)]
    [TestCase("")]
    [TestCase("not a date")]
    [TestCase("2026/07/23")]
    public void An_unreadable_licence_date_fails_closed(string? expiry)
    {
        // Including a GREGORIAN date: 2026 is outside the Jalali range, so it will not parse. Treating
        // an unparseable date as valid is exactly the hole a challenger would find.
        VoterEligibility.CheckVoter(Open(), Engineer(expiry: expiry), Today)
            .Status.ShouldBe(VoterStatus.LicenceExpired);
    }

    // ── discipline ───────────────────────────────────────────────────────────

    [Test]
    public void A_matching_discipline_may_vote()
        => VoterEligibility.CheckVoter(Open(ElectionEligibility.ByReshte, "4"), Engineer(reshte: "4"), Today)
            .IsEligible.ShouldBeTrue();

    [Test]
    public void A_different_discipline_is_refused()
        => VoterEligibility.CheckVoter(Open(ElectionEligibility.ByReshte, "4"), Engineer(reshte: "3"), Today)
            .Status.ShouldBe(VoterStatus.WrongReshte);

    [Test]
    public void AllMembers_ignores_the_discipline_entirely()
        => VoterEligibility.CheckVoter(Open(), Engineer(reshte: "7"), Today).IsEligible.ShouldBeTrue();

    [Test]
    public void Persian_digits_in_the_stored_code_still_match()
    {
        // The org's data and the admin's typing can both arrive with Persian digits.
        VoterEligibility.CheckVoter(Open(ElectionEligibility.ByReshte, "۴"), Engineer(reshte: "4"), Today)
            .IsEligible.ShouldBeTrue();
    }

    [Test]
    public void An_engineer_with_no_discipline_on_record_fails_closed()
    {
        // An empty code matching everything would silently open a restricted ballot to all comers.
        VoterEligibility.CheckVoter(Open(ElectionEligibility.ByReshte, "4"), Engineer(reshte: ""), Today)
            .Status.ShouldBe(VoterStatus.WrongReshte);
    }

    [Test]
    public void Any_one_of_several_allowed_disciplines_matches()
        => VoterEligibility.CheckVoter(
                Open(ElectionEligibility.ByReshte, "3", "4", "5"), Engineer(reshte: "5"), Today)
            .IsEligible.ShouldBeTrue();
}

/// <summary>
/// Architecture guards. These fail the build if someone reintroduces a leak the adversarial review
/// already found, which a code comment alone would not prevent.
/// </summary>
public class ElectionSecurityContractTests
{
    [Test]
    public void No_election_request_accepts_a_voter_identifier()
    {
        // The repo binds whole commands from the request body, so a national-code or voter-id field on
        // any of these would let a signed-in engineer vote as anyone whose کد ملی they know — and کد ملی
        // is public information in Iran. Identity must come from IUser only.
        var forbidden = new[] { "nationalcode", "codemeli", "voterid", "voterhash", "userid", "username" };

        var offenders = typeof(CastVoteCommand).Assembly
            .GetTypes()
            .Where(t => t.Namespace == "Mabhas19.Application.Elections")
            .Where(t => t.GetInterfaces().Any(i =>
                i.IsGenericType && i.GetGenericTypeDefinition().Name.StartsWith("IRequest")))
            .SelectMany(t => t.GetProperties(BindingFlags.Public | BindingFlags.Instance)
                .Where(p => forbidden.Contains(p.Name.ToLowerInvariant()))
                .Select(p => $"{t.Name}.{p.Name}"))
            .ToList();

        offenders.ShouldBeEmpty();
    }

    [Test]
    public void Casting_a_vote_is_marked_secret_so_it_never_reaches_a_log()
    {
        // {@UserName} is the کد ملی for engineer accounts, so one log line plus the ballot table's
        // arrival order reveals how each person voted, with no key involved.
        typeof(ISecretRequest).IsAssignableFrom(typeof(CastVoteCommand)).ShouldBeTrue();
        typeof(ISecretRequest).IsAssignableFrom(typeof(GetMyBallotsQuery)).ShouldBeTrue();
    }

    [Test]
    public void The_roll_and_the_ballot_share_no_property_name()
    {
        // If these two ever gain a common column, that column becomes the join key that links a person
        // to their choice.
        var roll = typeof(ElectionVoteReceipt).GetProperties().Select(p => p.Name).ToHashSet();
        var ballot = typeof(ElectionBallot).GetProperties().Select(p => p.Name).ToHashSet();

        roll.Intersect(ballot).ShouldBe(new[] { nameof(ElectionVoteReceipt.ElectionId) });
    }

    [Test]
    public void Neither_secret_table_carries_a_timestamp_or_an_audit_trail()
    {
        // Deriving BaseAuditableEntity would stamp CreatedBy with the voter's OIDC subject; any
        // timestamp at all is a join key against the other table.
        foreach (var t in new[] { typeof(ElectionVoteReceipt), typeof(ElectionBallot) })
        {
            var names = t.GetProperties().Select(p => p.Name).ToList();

            names.ShouldNotContain("Created");
            names.ShouldNotContain("CreatedBy");
            names.ShouldNotContain("LastModified");
            names.ShouldNotContain("LastModifiedBy");
            t.GetProperties().ShouldAllBe(p => p.PropertyType != typeof(DateTimeOffset));
        }
    }
}
