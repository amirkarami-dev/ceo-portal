using Mabhas19.Application.Common;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Elections;
using Mabhas19.Application.FunctionalTests.Infrastructure;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Elections;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.FunctionalTests.Elections;

/// <summary>
/// The voter flow, end to end through the real pipeline and a real database.
/// </summary>
/// <remarks>
/// <para>
/// This is step 7's success criterion — <b>a seeded engineer can vote once</b> — and the second half of
/// that sentence is the part that needs a real database. The one-vote guarantee is a UNIQUE key on
/// <c>(ElectionId, VoterHash)</c>, not an application check, so nothing short of an actual insert can
/// prove it holds.
/// </para>
/// <para>
/// The organisation's membership DB is replaced by <see cref="FakeEngineerDirectory"/> — see its
/// remarks for why tests must never reach the real one.
/// </para>
/// </remarks>
public class VoteFlowTests : TestBase
{
    private const string Voter = "1234567890";
    private const string OtherVoter = "9876543210";
    private const string Mechanical = "4";
    private const string Electrical = "5";

    /// <summary>An active member with a licence valid well into the future.</summary>
    private static EngineerInfo Engineer(string nationalCode, string reshte = Mechanical) => new(
        NationalCode: nationalCode,
        FirstName: "آزمون",
        LastName: "مهندس",
        ReshteCode: reshte,
        Mobile: "09120000000",
        MembershipStatus: 0,
        LicenceExpiryJalali: "1499/12/29",
        EducationLevel: "کارشناسی");

    /// <summary>
    /// A published election that is open right now, with three candidates.
    /// </summary>
    /// <remarks>
    /// The window is set from absolute instants around <c>UtcNow</c> rather than from a Jalali date, so
    /// the test never becomes time-of-day dependent. <c>DateJalali</c> is still filled because it is
    /// non-null on the entity and shown to voters.
    /// </remarks>
    private static async Task<Election> SeedOpenElectionAsync(
        int maxSelections = 1,
        ElectionEligibility mode = ElectionEligibility.AllMembers,
        string[]? eligibleReshtes = null)
    {
        var now = DateTimeOffset.UtcNow;

        var election = new Election
        {
            Title = "انتخاب هیئت رئیسه واحد گاز",
            Status = ElectionStatus.Published,
            EligibilityMode = mode,
            DateJalali = "1405/05/01",
            Date = new DateOnly(2026, 7, 23),
            StartTime = new TimeOnly(0, 0),
            EndTime = new TimeOnly(23, 59),
            OpensAtUtc = now.AddHours(-1),
            ClosesAtUtc = now.AddHours(1),
            MaxSelections = maxSelections,
            Candidates =
            {
                new ElectionCandidate { FullName = "کاندیدای اول", ReshteCode = Mechanical, SortOrder = 0 },
                new ElectionCandidate { FullName = "کاندیدای دوم", ReshteCode = Electrical, SortOrder = 1 },
                new ElectionCandidate { FullName = "کاندیدای سوم", SortOrder = 2 }
            }
        };

        foreach (var code in eligibleReshtes ?? [])
        {
            election.EligibleReshtes.Add(new ElectionEligibleReshte
            {
                ReshteCode = code,
                ReshteLabel = ReshteNames.Describe(code)
            });
        }

        await TestApp.AddAsync(election);
        return election;
    }

    private static async Task<List<int>> CandidateIdsAsync(int electionId)
    {
        var ballots = await TestApp.SendAsync(new GetMyBallotsQuery());
        return ballots.Single(b => b.Id == electionId).Candidates.Select(c => c.Id).ToList();
    }

    // ── the criterion ────────────────────────────────────────────────────────

    [Test]
    public async Task A_seeded_engineer_can_vote_once()
    {
        TestApp.RunAsEngineerAsync(Voter);
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();
        var candidates = await CandidateIdsAsync(election.Id);

        var result = await TestApp.SendAsync(
            new CastVoteCommand(election.Id, [candidates[0]]));

        result.Accepted.ShouldBeTrue();
        (await TestApp.CountAsync<ElectionVoteReceipt>()).ShouldBe(1);
        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(1);
    }

    [Test]
    public async Task A_second_vote_by_the_same_engineer_is_refused_and_adds_nothing()
    {
        TestApp.RunAsEngineerAsync(Voter);
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();
        var candidates = await CandidateIdsAsync(election.Id);

        await TestApp.SendAsync(new CastVoteCommand(election.Id, [candidates[0]]));

        // Different candidate, same voter: the refusal must come from the roll, not from any
        // "did you pick the same person?" comparison.
        var second = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new CastVoteCommand(election.Id, [candidates[1]])));

        second.Errors["Voter"].ShouldContain("شما قبلاً در این انتخابات رأی داده‌اید");

        // The important half: the rejected attempt left no trace. A second ballot without a second
        // receipt would inflate the tally while the turnout stayed honest — invisible in both numbers.
        (await TestApp.CountAsync<ElectionVoteReceipt>()).ShouldBe(1);
        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(1);
    }

    [Test]
    public async Task A_different_engineer_can_still_vote()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        FunctionalTestSetup.Directory.Add(Engineer(OtherVoter));
        var election = await SeedOpenElectionAsync();

        TestApp.RunAsEngineerAsync(Voter);
        var candidates = await CandidateIdsAsync(election.Id);
        await TestApp.SendAsync(new CastVoteCommand(election.Id, [candidates[0]]));

        TestApp.RunAsEngineerAsync(OtherVoter);
        await TestApp.SendAsync(new CastVoteCommand(election.Id, [candidates[0]]));

        (await TestApp.CountAsync<ElectionVoteReceipt>()).ShouldBe(2);
        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(2);
    }

    // ── what the voter is shown ──────────────────────────────────────────────

    [Test]
    public async Task The_ballot_list_offers_the_vote_before_and_reports_it_after()
    {
        TestApp.RunAsEngineerAsync(Voter);
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        var before = (await TestApp.SendAsync(new GetMyBallotsQuery())).Single();
        before.CanVote.ShouldBeTrue();
        before.AlreadyVoted.ShouldBeFalse();
        before.Reason.ShouldBeEmpty();

        await TestApp.SendAsync(new CastVoteCommand(election.Id, [before.Candidates[0].Id]));

        // The UI reads exactly these two fields to decide whether to offer a ballot, so they have to
        // flip together with the receipt.
        var after = (await TestApp.SendAsync(new GetMyBallotsQuery())).Single();
        after.AlreadyVoted.ShouldBeTrue();
        after.CanVote.ShouldBeFalse();
        after.Reason.ShouldBe("شما قبلاً در این انتخابات رأی داده‌اید");
    }

    [Test]
    public async Task A_draft_election_is_invisible_to_voters()
    {
        // A draft is where an admin is still changing candidates. Showing it would let someone vote on
        // a ballot that then changed underneath them.
        TestApp.RunAsEngineerAsync(Voter);
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        await TestApp.MutateAsync<Election>(e => e.Status = ElectionStatus.Draft, election.Id);

        (await TestApp.SendAsync(new GetMyBallotsQuery())).ShouldBeEmpty();
    }

    [Test]
    public async Task Candidate_cards_show_the_discipline_name_not_the_code()
    {
        TestApp.RunAsEngineerAsync(Voter);
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        var ballot = (await TestApp.SendAsync(new GetMyBallotsQuery())).Single(b => b.Id == election.Id);

        ballot.Candidates[0].ReshteLabelOrCode.ShouldBe("مکانیک");
        ballot.Candidates[1].ReshteLabelOrCode.ShouldBe("برق");
        // No code at all → no row on the card, rather than an empty tag.
        ballot.Candidates[2].ReshteLabelOrCode.ShouldBeNull();
    }

    [Test]
    public async Task Candidate_order_is_the_admins_order()
    {
        TestApp.RunAsEngineerAsync(Voter);
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();

        var ballot = (await TestApp.SendAsync(new GetMyBallotsQuery())).Single(b => b.Id == election.Id);

        // A shifting order would change what voters see and could be argued to favour someone.
        ballot.Candidates.Select(c => c.FullName)
            .ShouldBe(["کاندیدای اول", "کاندیدای دوم", "کاندیدای سوم"]);
    }

    // ── eligibility, all failing closed ──────────────────────────────────────

    [Test]
    public async Task An_engineer_of_another_discipline_is_refused()
    {
        TestApp.RunAsEngineerAsync(Voter);
        FunctionalTestSetup.Directory.Add(Engineer(Voter, Electrical));
        var election = await SeedOpenElectionAsync(
            mode: ElectionEligibility.ByReshte, eligibleReshtes: [Mechanical]);

        var candidates = await CandidateIdsAsync(election.Id);

        await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new CastVoteCommand(election.Id, [candidates[0]])));

        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(0);
    }

    [Test]
    public async Task An_inactive_member_is_refused()
    {
        TestApp.RunAsEngineerAsync(Voter);
        FunctionalTestSetup.Directory.Add(Engineer(Voter) with { MembershipStatus = 1 });
        var election = await SeedOpenElectionAsync();

        await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new CastVoteCommand(election.Id, [1])));

        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(0);
    }

    [Test]
    public async Task An_expired_licence_is_refused()
    {
        TestApp.RunAsEngineerAsync(Voter);
        FunctionalTestSetup.Directory.Add(Engineer(Voter) with { LicenceExpiryJalali = "1400/01/01" });
        var election = await SeedOpenElectionAsync();

        await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new CastVoteCommand(election.Id, [1])));

        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(0);
    }

    [Test]
    public async Task An_unknown_national_code_is_refused()
    {
        TestApp.RunAsEngineerAsync(Voter); // directory left empty
        var election = await SeedOpenElectionAsync();

        await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new CastVoteCommand(election.Id, [1])));

        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(0);
    }

    [Test]
    public async Task A_directory_outage_is_reported_as_an_outage_not_as_ineligibility()
    {
        // The trap this guards: an outage that reused «این کد ملی یافت نشد» would tell every voter they
        // are not a member, and the office would spend election day fielding calls about it.
        TestApp.RunAsEngineerAsync(Voter);
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        FunctionalTestSetup.Directory.IsUnavailable = true;
        var election = await SeedOpenElectionAsync();

        var ballot = (await TestApp.SendAsync(new GetMyBallotsQuery())).Single(b => b.Id == election.Id);

        ballot.CanVote.ShouldBeFalse();
        ballot.Reason.ShouldNotContain("یافت نشد");

        var ex = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new CastVoteCommand(election.Id, [1])));
        ex.Errors.Values.SelectMany(v => v).ShouldAllBe(m => !m.Contains("یافت نشد"));
    }

    // ── selection rules ──────────────────────────────────────────────────────

    [Test]
    public async Task Choosing_more_than_the_maximum_is_refused()
    {
        TestApp.RunAsEngineerAsync(Voter);
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync(maxSelections: 2);
        var candidates = await CandidateIdsAsync(election.Id);

        var ex = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new CastVoteCommand(election.Id, candidates.ToArray())));

        ex.Errors["CandidateIds"].ShouldContain("حداکثر 2 کاندیدا می‌توانید انتخاب کنید");
        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(0);
    }

    [Test]
    public async Task Choosing_the_same_candidate_twice_is_refused()
    {
        // Otherwise one voter could cast two votes for one candidate inside a multi-select election.
        TestApp.RunAsEngineerAsync(Voter);
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync(maxSelections: 2);
        var candidates = await CandidateIdsAsync(election.Id);

        await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new CastVoteCommand(election.Id, [candidates[0], candidates[0]])));

        (await TestApp.CountAsync<ElectionBallot>()).ShouldBe(0);
    }

    [Test]
    public async Task A_candidate_from_another_election_is_refused()
    {
        TestApp.RunAsEngineerAsync(Voter);
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var mine = await SeedOpenElectionAsync();
        var other = await SeedOpenElectionAsync();

        var otherCandidates = await CandidateIdsAsync(other.Id);

        var ex = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new CastVoteCommand(mine.Id, [otherCandidates[0]])));

        ex.Errors["CandidateIds"].ShouldContain("کاندیدای انتخابی در این انتخابات وجود ندارد");
    }

    // ── secrecy ──────────────────────────────────────────────────────────────

    [Test]
    public async Task The_receipt_records_nothing_but_the_election_and_a_hash()
    {
        // Any extra column here — a timestamp, a channel, the OIDC subject — pairs a voter with the
        // ballot that arrived next to it. This asserts the shape stays minimal.
        var columns = typeof(ElectionVoteReceipt).GetProperties().Select(p => p.Name).ToList();

        columns.ShouldBe(["ElectionId", "VoterHash"], ignoreOrder: true);

        TestApp.RunAsEngineerAsync(Voter);
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var election = await SeedOpenElectionAsync();
        var candidates = await CandidateIdsAsync(election.Id);

        await TestApp.SendAsync(new CastVoteCommand(election.Id, [candidates[0]]));

        var stored = (await TestApp.AllAsync<ElectionVoteReceipt>()).Single();

        stored.ElectionId.ShouldBe(election.Id);
        stored.VoterHash.Length.ShouldBe(32);
    }

    [Test]
    public async Task The_same_voter_hashes_differently_in_a_different_election()
    {
        // The roll is keyed per election, so two rolls cannot be joined to reveal that one person voted
        // in both. This is the property that makes the receipt table safe to keep forever.
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        var first = await SeedOpenElectionAsync();
        var second = await SeedOpenElectionAsync();

        TestApp.RunAsEngineerAsync(Voter);
        await TestApp.SendAsync(
            new CastVoteCommand(first.Id, [(await CandidateIdsAsync(first.Id))[0]]));
        await TestApp.SendAsync(
            new CastVoteCommand(second.Id, [(await CandidateIdsAsync(second.Id))[0]]));

        var hashes = (await TestApp.AllAsync<ElectionVoteReceipt>())
            .Select(r => Convert.ToHexString(r.VoterHash))
            .ToList();

        hashes.Count.ShouldBe(2);
        hashes[0].ShouldNotBe(hashes[1]);
    }

    [Test]
    public async Task Two_identical_votes_seal_to_different_bytes()
    {
        // The only assertion that actually proves the ballot is encrypted rather than encoded: two
        // voters choosing the SAME candidate must produce different ciphertext. If sealing were
        // deterministic, anyone with database access could group the ballots by value and read off the
        // result — and, combined with arrival order, work out who voted for whom.
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        FunctionalTestSetup.Directory.Add(Engineer(OtherVoter));
        var election = await SeedOpenElectionAsync();

        TestApp.RunAsEngineerAsync(Voter);
        var candidates = await CandidateIdsAsync(election.Id);
        await TestApp.SendAsync(new CastVoteCommand(election.Id, [candidates[0]]));

        TestApp.RunAsEngineerAsync(OtherVoter);
        await TestApp.SendAsync(new CastVoteCommand(election.Id, [candidates[0]]));

        var ballots = await TestApp.AllAsync<ElectionBallot>();

        ballots.Count.ShouldBe(2);
        ballots[0].BallotId.ShouldNotBe(ballots[1].BallotId);
        Convert.ToHexString(ballots[0].Sealed)
            .ShouldNotBe(Convert.ToHexString(ballots[1].Sealed));
    }

    // ── the tally ────────────────────────────────────────────────────────────

    [Test]
    public async Task The_tally_counts_what_was_actually_cast()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Voter));
        FunctionalTestSetup.Directory.Add(Engineer(OtherVoter));
        var election = await SeedOpenElectionAsync();

        TestApp.RunAsEngineerAsync(Voter);
        var candidates = await CandidateIdsAsync(election.Id);
        await TestApp.SendAsync(new CastVoteCommand(election.Id, [candidates[1]]));

        TestApp.RunAsEngineerAsync(OtherVoter);
        await TestApp.SendAsync(new CastVoteCommand(election.Id, [candidates[1]]));

        // Close the window, then count as an administrator. Back-dating the instant directly because
        // there is deliberately no command that reopens or closes a window early.
        await TestApp.MutateAsync<Election>(
            e => e.ClosesAtUtc = DateTimeOffset.UtcNow.AddMinutes(-1), election.Id);
        TestApp.RunAsEngineerAsync("0000000000", Roles.Administrator);

        var outcome = await TestApp.SendAsync(new TallyElectionCommand(election.Id));

        outcome.BallotsCounted.ShouldBe(2);
        outcome.VotesCounted.ShouldBe(2);
        outcome.WasRecount.ShouldBeFalse();

        var result = await TestApp.SendAsync(new GetElectionResultQuery(election.Id));

        result.BallotsCast.ShouldBe(2);
        result.Candidates.Single(c => c.CandidateId == candidates[1]).Votes.ShouldBe(2);
        result.Candidates.Single(c => c.CandidateId == candidates[0]).Votes.ShouldBe(0);
        // A candidate nobody voted for still appears, or the ballot would look shorter than it was.
        result.Candidates.Count.ShouldBe(3);
    }
}
