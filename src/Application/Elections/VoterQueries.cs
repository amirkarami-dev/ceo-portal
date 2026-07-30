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
    /// <summary>
    /// Absolute instants for the window, so a client can count down without re-deriving a Jalali date
    /// plus the Iran offset. <see cref="Phase"/> stays the authority on whether voting is open — the
    /// countdown only decides when to ask the server again.
    /// </summary>
    DateTimeOffset OpensAtUtc,
    DateTimeOffset ClosesAtUtc,
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

public class GetMyBallotsQueryHandler(IElectionBrowser browser, IUser user)
    : IRequestHandler<GetMyBallotsQuery, IReadOnlyList<BallotDto>>
{
    public Task<IReadOnlyList<BallotDto>> Handle(
        GetMyBallotsQuery request,
        CancellationToken cancellationToken)
        // Engineer accounts use the کد ملی as the username. A non-engineer account passes an unusable
        // value through and every election comes back with a "not a member" reason, which is correct:
        // an administrator signed in by e-mail genuinely cannot vote.
        => browser.GetBallotsForAsync(user.Name ?? string.Empty, cancellationToken);
}

/// <summary>
/// Builds the voter's ballot list for a given کد ملی.
/// </summary>
/// <remarks>
/// <para>
/// Extracted from the query handler for the same reason as <see cref="IBallotCaster"/>: there are two
/// channels and one set of eligibility rules. The Bale bot has no OIDC identity to read, so without this
/// it would need its own copy of "which elections may this person vote in", and the copy that drifted
/// would either hide an election from someone entitled to it or offer one the cast then refuses.
/// </para>
/// <para>
/// The کد ملی is a parameter here and must never be one on a command bound from a request body — see the
/// remarks on <see cref="IBallotCaster"/>. Callers are responsible for having authenticated it.
/// </para>
/// </remarks>
public interface IElectionBrowser
{
    Task<IReadOnlyList<BallotDto>> GetBallotsForAsync(
        string nationalCode,
        CancellationToken cancellationToken);
}

public class ElectionBrowser(
    IApplicationDbContext context,
    IEngineerDirectory directory,
    IVoterRoll roll,
    IBallotSealer sealer,
    TimeProvider clock) : IElectionBrowser
{
    public async Task<IReadOnlyList<BallotDto>> GetBallotsForAsync(
        string nationalCode,
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

        EngineerInfo? engineer = null;

        // Treat a crypto or directory misconfiguration exactly as the cast does. Otherwise this query
        // would happily show canVote:true and the cast would then refuse with a different reason —
        // the UI promising something the server will not honour. The SEALER belongs in this list for the
        // same reason: BallotCaster refuses without it, so leaving it out here offered a ballot that
        // could not be cast, and on the bot that meant burning a fresh OTP to reach the refusal.
        var votingAvailable = roll.IsConfigured && sealer.IsConfigured && directory.IsConfigured;
        var lookupFailed = !votingAvailable;

        // A malformed code is not looked up at all: VoterRoll.ComputeHash would throw on it further
        // down, and an outage flag here would wrongly report the org's database as broken.
        var usable = BallotCaster.IsWellFormedNationalCode(nationalCode);

        if (votingAvailable && usable)
        {
            var lookup = await directory.LookupAsync(nationalCode, cancellationToken);
            engineer = lookup.Engineer;
            lookupFailed = lookup.Outcome == DirectoryOutcome.Unavailable;
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
            if (voterCheck.IsEligible)
            {
                // Hash the AUTHENTICATED identity, matching the cast — not the directory's echo.
                // Reachable only when `usable` held, because eligibility requires a found engineer.
                var hash = roll.ComputeHash(e.Id, nationalCode);
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
                e.OpensAtUtc,
                e.ClosesAtUtc,
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
                        // The Persian name, not the raw code. ElectionCandidate stores only the code, so
                        // without this the card reads «۴» where the voter expects «مکانیک». An unknown
                        // code degrades to «رشتهٔ N» rather than blanking the field.
                        ReshteNames.Describe(c.ReshteCode),
                        c.EducationLevel,
                        c.Image))
                    .ToList()));
        }

        return result;
    }
}
