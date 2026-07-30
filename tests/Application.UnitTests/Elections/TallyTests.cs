using System.Security.Cryptography;
using Mabhas19.Application.Elections;
using Mabhas19.Domain.Elections;
using Mabhas19.Infrastructure.Elections;
using Microsoft.Extensions.Options;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Elections;

/// <summary>
/// The tally, end to end through the real sealer: seal a known set of ballots, open them, and check the
/// counts are exact. This is step 5's success criterion.
/// </summary>
public class TallyTests
{
    private const string Key = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";
    private const int ElectionId = 7;

    private static BallotSealer Sealer() =>
        new(Options.Create(new ElectionCryptoOptions { BallotMasterKey = Key }));

    /// <summary>Seals one ballot per voter, exactly as CastVoteCommandHandler does.</summary>
    private static List<ElectionBallot> Seed(int maxSelections, params int[][] votes)
    {
        var s = Sealer();
        return votes.Select(v => new ElectionBallot
        {
            BallotId = Guid.NewGuid(),
            ElectionId = ElectionId,
            KeyVersion = 1,
            Sealed = s.Seal(ElectionId, 1, maxSelections, v)
        }).ToList();
    }

    /// <summary>The counting loop from TallyElectionCommandHandler, over sealed ballots.</summary>
    private static Dictionary<int, int> Count(IEnumerable<ElectionBallot> ballots, int maxSelections)
    {
        var s = Sealer();
        var tally = new Dictionary<int, int>();

        foreach (var b in ballots)
        {
            foreach (var id in s.Open(ElectionId, b.KeyVersion, maxSelections, b.Sealed))
            {
                tally[id] = tally.GetValueOrDefault(id) + 1;
            }
        }

        return tally;
    }

    [Test]
    public void Single_choice_counts_are_exact()
    {
        // 5 voters: candidate 11 gets 3, candidate 12 gets 2.
        var ballots = Seed(1, [11], [11], [12], [11], [12]);

        var tally = Count(ballots, 1);

        tally[11].ShouldBe(3);
        tally[12].ShouldBe(2);
        tally.Values.Sum().ShouldBe(5);
    }

    [Test]
    public void Multi_choice_counts_every_selection()
    {
        // 3 voters picking up to 3. Total selections (7) is deliberately more than voters (3) —
        // conflating the two is the classic multi-choice tally bug.
        var ballots = Seed(3, [11, 12, 13], [11, 12], [11, 13]);

        var tally = Count(ballots, 3);

        tally[11].ShouldBe(3);
        tally[12].ShouldBe(2);
        tally[13].ShouldBe(2);
        tally.Values.Sum().ShouldBe(7);
        ballots.Count.ShouldBe(3);
    }

    [Test]
    public void A_voter_using_fewer_than_the_maximum_is_counted_correctly()
    {
        // Padding must not become votes. Zero slots are skipped on open.
        var ballots = Seed(3, [11], [12, 13]);

        var tally = Count(ballots, 3);

        tally.Values.Sum().ShouldBe(3);
        tally.ShouldNotContainKey(0);
    }

    [Test]
    public void An_empty_election_tallies_to_nothing_rather_than_failing()
        => Count([], 1).ShouldBeEmpty();

    // ── digest ───────────────────────────────────────────────────────────────

    [Test]
    public void The_digest_is_stable_across_recounts()
    {
        var ballots = Seed(1, [11], [12]);

        TallyElectionCommandHandler.ComputeDigest(ballots)
            .ShouldBe(TallyElectionCommandHandler.ComputeDigest(ballots));
    }

    [Test]
    public void The_digest_ignores_the_order_rows_come_back_in()
    {
        // SQL Server gives no ordering guarantee without ORDER BY, so the digest must not depend on it.
        var ballots = Seed(1, [11], [12], [13]);

        TallyElectionCommandHandler.ComputeDigest(ballots)
            .ShouldBe(TallyElectionCommandHandler.ComputeDigest(ballots.AsEnumerable().Reverse()));
    }

    [Test]
    public void Adding_a_ballot_changes_the_digest()
    {
        // This is what makes a recount safe: stuffing the box after the first count is detected.
        var ballots = Seed(1, [11], [12]);
        var before = TallyElectionCommandHandler.ComputeDigest(ballots);

        ballots.AddRange(Seed(1, [11]));

        TallyElectionCommandHandler.ComputeDigest(ballots).ShouldNotBe(before);
    }

    [Test]
    public void Removing_a_ballot_changes_the_digest()
    {
        var ballots = Seed(1, [11], [12], [13]);
        var before = TallyElectionCommandHandler.ComputeDigest(ballots);

        ballots.RemoveAt(1);

        TallyElectionCommandHandler.ComputeDigest(ballots).ShouldNotBe(before);
    }

    [Test]
    public void Editing_a_sealed_ballot_changes_the_digest()
    {
        var ballots = Seed(1, [11], [12]);
        var before = TallyElectionCommandHandler.ComputeDigest(ballots);

        ballots[0].Sealed[^1] ^= 0xFF;

        TallyElectionCommandHandler.ComputeDigest(ballots).ShouldNotBe(before);
    }

    [Test]
    public void The_digest_is_32_bytes()
        => TallyElectionCommandHandler.ComputeDigest(Seed(1, [11])).Length.ShouldBe(32);

    // ── integrity ────────────────────────────────────────────────────────────

    [Test]
    public void A_tampered_ballot_stops_the_tally_instead_of_being_skipped()
    {
        // Swallowing this would silently drop someone's vote and still publish a total that looked
        // complete — worse than failing, because nobody would know.
        var ballots = Seed(1, [11], [12]);
        ballots[1].Sealed[^1] ^= 0xFF;

        Should.Throw<CryptographicException>(() => Count(ballots, 1));
    }

    [Test]
    public void A_ballot_from_another_election_will_not_open()
    {
        var foreign = Sealer().Seal(electionId: 99, keyVersion: 1, maxSelections: 1, [11]);
        var ballots = new List<ElectionBallot>
        {
            new() { BallotId = Guid.NewGuid(), ElectionId = ElectionId, KeyVersion = 1, Sealed = foreign }
        };

        Should.Throw<CryptographicException>(() => Count(ballots, 1));
    }
}

/// <summary>Ranking rules for «نتیجه انتخابات».</summary>
public class ResultRankingTests
{
    /// <summary>
    /// The ranking logic from GetElectionResultQueryHandler: order by votes, ties share a rank, and the
    /// next rank skips (1, 2, 2, 4).
    /// </summary>
    private static List<(int Id, int Votes, int Rank, bool IsTie)> Rank(params (int Id, int Votes)[] input)
    {
        var ordered = input.OrderByDescending(x => x.Votes).ThenBy(x => x.Id).ToList();
        var output = new List<(int, int, int, bool)>();
        var rank = 0;
        var seen = 0;
        var previous = int.MinValue;

        foreach (var c in ordered)
        {
            seen++;
            if (c.Votes != previous)
            {
                rank = seen;
                previous = c.Votes;
            }

            output.Add((c.Id, c.Votes, rank, ordered.Count(o => o.Votes == c.Votes) > 1));
        }

        return output;
    }

    [Test]
    public void The_winner_is_the_most_votes()
        => Rank((11, 3), (12, 5), (13, 1))[0].Id.ShouldBe(12);

    [Test]
    public void Ties_share_a_rank_and_the_next_rank_skips()
    {
        var r = Rank((11, 5), (12, 5), (13, 2));

        r[0].Rank.ShouldBe(1);
        r[1].Rank.ShouldBe(1);
        r[2].Rank.ShouldBe(3);   // not 2 — two candidates already occupy first place
    }

    [Test]
    public void A_tie_is_flagged_so_the_UI_cannot_quietly_declare_one_winner()
    {
        var r = Rank((11, 5), (12, 5), (13, 2));

        r[0].IsTie.ShouldBeTrue();
        r[1].IsTie.ShouldBeTrue();
        r[2].IsTie.ShouldBeFalse();
    }

    [Test]
    public void Candidates_with_no_votes_still_appear()
    {
        // Dropping them would make the ballot look shorter than it was.
        var r = Rank((11, 3), (12, 0));

        r.Count.ShouldBe(2);
        r[1].Votes.ShouldBe(0);
    }

    [Test]
    public void An_all_zero_election_is_one_big_tie_rather_than_a_winner()
    {
        var r = Rank((11, 0), (12, 0));

        r.ShouldAllBe(x => x.Rank == 1);
        r.ShouldAllBe(x => x.IsTie);
    }
}
