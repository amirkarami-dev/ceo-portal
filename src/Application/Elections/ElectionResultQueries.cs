using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Elections;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Elections;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Elections;

/// <summary>One candidate's result. Ranked by votes, ties sharing a rank.</summary>
public sealed record CandidateResultDto(
    int CandidateId,
    string FullName,
    string? ReshteCode,
    string? EducationLevel,
    string? Image,
    int Votes,
    /// <summary>1-based. Tied candidates share a rank, and the next rank skips (1,2,2,4).</summary>
    int Rank,
    /// <summary>True when at least one other candidate has the same vote count.</summary>
    bool IsTie);

/// <summary>«نتیجه انتخابات» — the published outcome.</summary>
public sealed record ElectionResultDto(
    int ElectionId,
    string Title,
    string DateJalali,
    /// <summary>How many people voted. NOT broken down by discipline — see the remarks.</summary>
    int BallotsCast,
    /// <summary>Total candidate selections. Differs from BallotsCast when MaxSelections > 1.</summary>
    int VotesCast,
    int MaxSelections,
    string EligibilitySummary,
    DateTimeOffset TalliedAt,
    /// <summary>Hex digest over the sealed ballots at tally time — the evidence behind these numbers.</summary>
    string ResultDigest,
    /// <summary>True once the ballots have been purged, so these numbers can never be re-checked.</summary>
    bool BallotsPurged,
    IReadOnlyList<CandidateResultDto> Candidates);

/// <summary>
/// The published result of one election.
/// </summary>
/// <remarks>
/// <para>
/// Available to any authenticated member once the election has been tallied — a result nobody can read
/// is not a result. Before that it does not exist, and mid-vote it must not: a partial count would tell
/// later voters which way it is going.
/// </para>
/// <para>
/// <b>There is deliberately no turnout breakdown by discipline.</b> The roll holds only
/// <c>(ElectionId, VoterHash)</c> — no discipline, no channel, no timestamp — so "how many مکانیک
/// engineers voted" is not computable without adding a column that would weaken the roll. That is the
/// secrecy working as intended, not a missing feature.
/// </para>
/// </remarks>
[Authorize]
public record GetElectionResultQuery(int Id) : IRequest<ElectionResultDto>;

public class GetElectionResultQueryHandler(
    IApplicationDbContext context,
    IBallotSealer sealer,
    TimeProvider clock) : IRequestHandler<GetElectionResultQuery, ElectionResultDto>
{
    public async Task<ElectionResultDto> Handle(
        GetElectionResultQuery request,
        CancellationToken cancellationToken)
    {
        var election = await context.Elections
            .AsNoTracking()
            .Include(e => e.Candidates)
            .Include(e => e.EligibleReshtes)
            .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, election);

        if (election.TalliedAt is null || election.PhaseAt(clock.GetUtcNow()) != ElectionPhase.ResultsAvailable)
        {
            // Not found rather than forbidden: "results exist but you cannot see them" is itself
            // information, and before the tally there is genuinely nothing to return.
            throw new NotFoundException(request.Id.ToString(), nameof(ElectionResultDto));
        }

        // Turnout comes from the ROLL, not the ballots — the roll survives the 30-day purge, so the
        // number of voters stays provable forever even after the ballots are gone.
        var ballotsCast = await context.ElectionVoteReceipts
            .AsNoTracking()
            .CountAsync(r => r.ElectionId == election.Id, cancellationToken);

        var counts = new Dictionary<int, int>();
        var votesCast = 0;

        if (election.BallotsPurgedAt is null && sealer.IsConfigured)
        {
            var ballots = await context.ElectionBallots
                .AsNoTracking()
                .Where(b => b.ElectionId == election.Id)
                .ToListAsync(cancellationToken);

            foreach (var b in ballots)
            {
                foreach (var id in sealer.Open(election.Id, b.KeyVersion, election.MaxSelections, b.Sealed))
                {
                    counts[id] = counts.GetValueOrDefault(id) + 1;
                    votesCast++;
                }
            }
        }

        // Rank by votes, then by ballot order so the list is stable between loads. A candidate with no
        // votes still appears — omitting them would make the ballot look shorter than it was.
        var ordered = election.Candidates
            .OrderByDescending(c => counts.GetValueOrDefault(c.Id))
            .ThenBy(c => c.SortOrder)
            .ToList();

        var results = new List<CandidateResultDto>(ordered.Count);
        var rank = 0;
        var seen = 0;
        var previousVotes = int.MinValue;

        foreach (var c in ordered)
        {
            var votes = counts.GetValueOrDefault(c.Id);
            seen++;

            // Standard competition ranking: equal votes share a rank, and the next rank skips.
            if (votes != previousVotes)
            {
                rank = seen;
                previousVotes = votes;
            }

            var isTie = ordered.Count(o => counts.GetValueOrDefault(o.Id) == votes) > 1;

            results.Add(new CandidateResultDto(
                c.Id, c.FullName, c.ReshteCode, c.EducationLevel, c.Image, votes, rank, isTie));
        }

        return new ElectionResultDto(
            election.Id,
            election.Title,
            election.DateJalali,
            ballotsCast,
            votesCast,
            election.MaxSelections,
            EligibilityText.Describe(election.EligibilityMode, election.EligibleReshtes),
            election.TalliedAt.Value,
            election.ResultDigest is null ? string.Empty : Convert.ToHexString(election.ResultDigest),
            election.BallotsPurgedAt is not null,
            results);
    }
}
