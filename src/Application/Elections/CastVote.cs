using Ardalis.GuardClauses;
using Mabhas19.Application.Common;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Elections;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Elections;
using Microsoft.EntityFrameworkCore;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Elections;

/// <summary>
/// Cast one ballot.
/// </summary>
/// <remarks>
/// <para>
/// <b>There is deliberately NO voter identifier on this command.</b> This repo binds whole commands
/// straight from the request body (see <c>Projects.CreateProject</c>), so a
/// <c>VoterNationalCode</c> parameter here would let any signed-in engineer vote as anyone whose کد ملی
/// they know — and کد ملی is not secret in Iran. Identity comes from <see cref="IUser"/> only.
/// An architecture test enforces this; do not add a field for the bot's convenience.
/// </para>
/// <para>
/// <see cref="ISecretRequest"/> keeps this out of the logs entirely — for engineer accounts the
/// username IS the کد ملی, so one log line plus the ballot table's arrival order reveals how each
/// person voted with no key needed.
/// </para>
/// </remarks>
[Authorize]
public record CastVoteCommand(int ElectionId, int[] CandidateIds) : IRequest<CastVoteResult>, ISecretRequest;

public sealed record CastVoteResult(bool Accepted, string Message);

public class CastVoteCommandValidator : AbstractValidator<CastVoteCommand>
{
    public CastVoteCommandValidator()
    {
        RuleFor(x => x.ElectionId).GreaterThan(0);
        RuleFor(x => x.CandidateIds).NotEmpty().WithMessage("هیچ کاندیدایی انتخاب نشده است");
    }
}

public class CastVoteCommandHandler(
    IApplicationDbContext context,
    IEngineerDirectory directory,
    IVoterRoll roll,
    IBallotSealer sealer,
    IUser user,
    TimeProvider clock) : IRequestHandler<CastVoteCommand, CastVoteResult>
{
    public async Task<CastVoteResult> Handle(CastVoteCommand request, CancellationToken cancellationToken)
    {
        // Everything the vote depends on must be present BEFORE we tell anyone anything. The
        // directory is included: without it we cannot check eligibility, and reporting that as
        // "you are not a member" is the outage-looks-like-mass-ineligibility trap.
        if (!roll.IsConfigured || !sealer.IsConfigured || !directory.IsConfigured)
        {
            // Better unavailable than unsafe: sealing under a default key would produce ballots
            // anyone could open, and hashing without a pepper would make the roll reversible.
            throw Fail("Configuration", "سامانهٔ رأی‌گیری در حال حاضر در دسترس نیست");
        }

        // AsNoTracking is deliberate. Election and ElectionCandidate derive BaseAuditableEntity, so a
        // tracked one in this unit of work is a single stray assignment away from the audit
        // interceptor stamping LastModifiedBy = the voter's OIDC subject on a row a DB reader can see —
        // right beside their ballot. Nothing here needs to mutate the election.
        var election = await context.Elections
            .AsNoTracking()
            .Include(e => e.Candidates)
            .Include(e => e.EligibleReshtes)
            .FirstOrDefaultAsync(e => e.Id == request.ElectionId, cancellationToken);

        Guard.Against.NotFound(request.ElectionId, election);

        var now = clock.GetUtcNow();

        // 1-2. Election-level checks first — no point calling the org's SQL Server when voting is shut.
        var electionCheck = VoterEligibility.CheckElection(election, now);
        if (!electionCheck.IsEligible)
        {
            throw Fail("Election", electionCheck.Message);
        }

        // Engineer accounts use the کد ملی as the username (same as the welfare flow).
        var nationalCode = user.Name;
        if (string.IsNullOrWhiteSpace(nationalCode) || !IsWellFormedNationalCode(nationalCode))
        {
            // Checked here so a non-engineer account (or a malformed username) gets a Persian refusal.
            // Letting VoterRoll.ComputeHash throw would surface as a 500 and, in the ballot list,
            // would break the whole page for that user instead of one election.
            throw Fail("Voter", "حساب کاربری شما برای رأی دادن معتبر نیست");
        }

        // 3-6. Person-level checks against the org record. LookupAsync — not
        // GetByNationalCodeAsync — because only it can tell an outage from an unknown code.
        var lookup = await directory.LookupAsync(nationalCode, cancellationToken);

        var voterCheck = VoterEligibility.CheckVoter(
            election,
            lookup.Engineer,
            IranTime.Today(now),
            lookupFailed: lookup.Outcome == DirectoryOutcome.Unavailable);

        if (!voterCheck.IsEligible)
        {
            throw Fail("Voter", voterCheck.Message);
        }

        // Candidates must belong to THIS election. Without this, a valid id from another election
        // would seal fine and then tally as a vote for nobody.
        var validIds = election.Candidates.Select(c => c.Id).ToHashSet();
        var chosen = request.CandidateIds.Distinct().ToArray();

        if (chosen.Length != request.CandidateIds.Length)
        {
            throw Fail("CandidateIds", "انتخاب تکراری مجاز نیست");
        }

        if (chosen.Any(id => !validIds.Contains(id)))
        {
            throw Fail("CandidateIds", "کاندیدای انتخابی در این انتخابات وجود ندارد");
        }

        if (chosen.Length > election.MaxSelections)
        {
            throw Fail("CandidateIds",
                $"حداکثر {election.MaxSelections} کاندیدا می‌توانید انتخاب کنید");
        }

        // Re-read the clock and re-check the window. The lookup above crosses the network to the org's
        // SQL Server and can stall for seconds; without this a request that arrived one second before
        // closing could commit well after it, which is exactly what a losing candidate would point at.
        if (clock.GetUtcNow() >= election.ClosesAtUtc)
        {
            throw Fail("Election", "زمان رأی‌گیری این انتخابات به پایان رسیده است");
        }

        // Pin the pepper to the election on the first cast, and refuse afterwards if it changed. A
        // changed pepper hashes the same person differently, which silently voids the one-vote key and
        // hands everyone a second vote. IVoterRoll is a singleton, so two hosts CAN hold two peppers.
        var fingerprint = roll.Fingerprint;
        var pinned = await context.Elections
            .AsNoTracking()
            .Where(e => e.Id == election.Id)
            .Select(e => e.RollFingerprint)
            .FirstAsync(cancellationToken);

        if (pinned is not null && !pinned.SequenceEqual(fingerprint))
        {
            throw Fail("Configuration",
                "پیکربندی سامانهٔ رأی‌گیری تغییر کرده است؛ لطفاً با مدیر سامانه تماس بگیرید");
        }

        // Key the roll on the AUTHENTICATED identity, not on whatever the directory echoed back. The
        // directory now verifies the two agree, but keying on the token means the org's database can
        // never move a voter's roll entry onto someone else even if that check is ever weakened.
        var voterHash = roll.ComputeHash(election.Id, nationalCode);

        context.ElectionVoteReceipts.Add(new ElectionVoteReceipt
        {
            ElectionId = election.Id,
            VoterHash = voterHash
        });

        context.ElectionBallots.Add(new ElectionBallot
        {
            // App-generated random v4 — never a database sequence, or primary-key order would equal
            // voting order.
            BallotId = Guid.NewGuid(),
            ElectionId = election.Id,
            Sealed = sealer.Seal(election.Id, election.KeyVersion, election.MaxSelections, chosen),
            KeyVersion = election.KeyVersion
        });

        // Pin the fingerprint on the first cast only. Done with a targeted UPDATE rather than by
        // tracking the Election, so no auditable entity joins this unit of work — see the
        // AsNoTracking note above. The WHERE guard makes it a no-op for every later voter.
        if (pinned is null)
        {
            await context.Elections
                .Where(e => e.Id == election.Id && e.RollFingerprint == null)
                .ExecuteUpdateAsync(s => s.SetProperty(e => e.RollFingerprint, fingerprint), cancellationToken);
        }

        try
        {
            await context.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException)
        {
            // The UNIQUE key on (ElectionId, VoterHash) is what actually stops a second vote —
            // including a web/bot race that an application-level "have you voted?" check would lose.
            //
            // Rather than matching SQL Server error numbers (which would drag the provider into the
            // Application layer and break under another database), ask the database the question that
            // matters: does a receipt for this voter exist NOW? Our own failed insert rolled back, so a
            // row can only be there if a different, committed transaction put it there — which is
            // exactly the duplicate case.
            var alreadyVoted = await context.ElectionVoteReceipts
                .AsNoTracking()
                .AnyAsync(
                    r => r.ElectionId == election.Id && r.VoterHash == voterHash,
                    cancellationToken);

            if (alreadyVoted)
            {
                // Reaching here is the guarantee working, not a bug.
                throw Fail("Voter", "شما قبلاً در این انتخابات رأی داده‌اید");
            }

            // Anything else is a real failure. Rethrow — silently reporting success would lose a vote.
            throw;
        }

        return new CastVoteResult(true, "رأی شما با موفقیت ثبت شد");
    }

    /// <summary>
    /// Ten ASCII digits after folding Persian/Arabic digits — the same shape VoterRoll requires. Kept
    /// as a string throughout: parsing it as a number would drop a leading zero and collide two people.
    /// </summary>
    private static bool IsWellFormedNationalCode(string value)
    {
        var code = JalaliDate.NormalizeDigits(value).Trim();
        return code.Length == 10 && code.All(char.IsAsciiDigit);
    }

    private static ValidationException Fail(string field, string message)
    {
        var ex = new ValidationException();
        ex.Errors[field] = [message];
        return ex;
    }
}
