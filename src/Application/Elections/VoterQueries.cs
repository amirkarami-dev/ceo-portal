using Ardalis.GuardClauses;
using Mabhas19.Application.Common;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Elections;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Elections;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Elections;

/// <summary>A candidate as a voter sees them — the card. No vote counts before results.</summary>
public sealed record BallotCandidateDto(
    int Id,
    string FullName,
    string? Description,
    string? ReshteLabelOrCode,
    string? EducationLevel,
    string? Image);

/// <summary>One election as a voter sees it.</summary>
public sealed record BallotDto(
    int Id,
    string Title,
    string? Description,
    string DateJalali,
    TimeOnly StartTime,
    TimeOnly EndTime,
    int MaxSelections,
    ElectionPhase Phase,
    /// <summary>«ویژهٔ مهندسان رشتهٔ مکانیک» — so an excluded voter can see why.</summary>
    string EligibilitySummary,
    /// <summary>True only when this person may cast a ballot right now.</summary>
    bool CanVote,
    /// <summary>Why not, in Persian. Empty when <see cref="CanVote"/> is true.</summary>
    string Reason,
    bool AlreadyVoted,
    IReadOnlyList<BallotCandidateDto> Candidates);

/// <summary>
/// The elections this person can see, with a per-election verdict.
/// </summary>
/// <remarks>
/// Marked <see cref="ISecretRequest"/>: it reveals whether the caller has already voted, and the
/// username in a log line is their کد ملی. Logging "this person asked about election 7 at 12:04" is a
/// weaker leak than the cast itself, but it is the same kind, so it gets the same treatment.
/// </remarks>
[Authorize]
public record GetMyBallotsQuery : IRequest<IReadOnlyList<BallotDto>>, ISecretRequest;

public class GetMyBallotsQueryHandler(
    IApplicationDbContext context,
    IEngineerDirectory directory,
    IVoterRoll roll,
    IUser user,
    TimeProvider clock) : IRequestHandler<GetMyBallotsQuery, IReadOnlyList<BallotDto>>
{
    public async Task<IReadOnlyList<BallotDto>> Handle(
        GetMyBallotsQuery request,
        CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();

        // Published only, and only what is not long finished. A Draft election must never be visible
        // to a voter — that is where an admin is still changing candidates.
        var elections = await context.Elections
            .AsNoTracking()
            .Include(e => e.Candidates)
            .Include(e => e.EligibleReshtes)
            .Where(e => e.Status == ElectionStatus.Published)
            .OrderByDescending(e => e.OpensAtUtc)
            .Take(50)
            .ToListAsync(cancellationToken);

        if (elections.Count == 0)
        {
            return [];
        }

        var nationalCode = user.Name;
        EngineerInfo? engineer = null;
        var lookupFailed = false;

        if (!string.IsNullOrWhiteSpace(nationalCode))
        {
            try
            {
                engineer = await directory.GetByNationalCodeAsync(nationalCode, cancellationToken);
            }
            catch
            {
                lookupFailed = true;
            }
        }

        var today = IranTime.Today(now);
        var result = new List<BallotDto>(elections.Count);

        foreach (var e in elections)
        {
            var electionCheck = VoterEligibility.CheckElection(e, now);
            var voterCheck = VoterEligibility.CheckVoter(e, engineer, today, lookupFailed);

            // Only ask the roll when the person is otherwise allowed — computing a hash for someone
            // ineligible would put their code through the pepper for no reason.
            var alreadyVoted = false;
            if (voterCheck.IsEligible && roll.IsConfigured)
            {
                var hash = roll.ComputeHash(e.Id, engineer!.NationalCode);
                alreadyVoted = await context.ElectionVoteReceipts
                    .AsNoTracking()
                    .AnyAsync(r => r.ElectionId == e.Id && r.VoterHash == hash, cancellationToken);
            }

            var canVote = electionCheck.IsEligible && voterCheck.IsEligible && !alreadyVoted;

            var reason = !electionCheck.IsEligible ? electionCheck.Message
                : !voterCheck.IsEligible ? voterCheck.Message
                : alreadyVoted ? "شما قبلاً در این انتخابات رأی داده‌اید"
                : string.Empty;

            result.Add(new BallotDto(
                e.Id,
                e.Title,
                e.Description,
                e.DateJalali,
                e.StartTime,
                e.EndTime,
                e.MaxSelections,
                e.PhaseAt(now),
                EligibilityText.Describe(e.EligibilityMode, e.EligibleReshtes),
                canVote,
                reason,
                alreadyVoted,
                e.Candidates
                    .OrderBy(c => c.SortOrder)
                    .Select(c => new BallotCandidateDto(
                        c.Id,
                        c.FullName,
                        c.Description,
                        // The label the admin chose, falling back to the code — a missing label must
                        // not blank out the card.
                        string.IsNullOrWhiteSpace(c.ReshteCode) ? null : c.ReshteCode,
                        c.EducationLevel,
                        c.Image))
                    .ToList()));
        }

        return result;
    }
}
