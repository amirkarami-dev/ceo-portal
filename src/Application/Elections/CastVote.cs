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
        if (!roll.IsConfigured || !sealer.IsConfigured)
        {
            // Better unavailable than unsafe: sealing under a default key would produce ballots
            // anyone could open, and hashing without a pepper would make the roll reversible.
            throw Fail("Configuration", "سامانهٔ رأی‌گیری در حال حاضر در دسترس نیست");
        }

        var election = await context.Elections
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
        if (string.IsNullOrWhiteSpace(nationalCode))
        {
            throw Fail("Voter", "حساب کاربری شما برای رأی دادن معتبر نیست");
        }

        // 3-6. Person-level checks against the org record.
        EngineerInfo? engineer;
        var lookupFailed = false;
        try
        {
            engineer = await directory.GetByNationalCodeAsync(nationalCode, cancellationToken);
        }
        catch
        {
            // The directory already swallows its own errors and returns null, but if that ever
            // changes an outage must not be reported as "you are not a member".
            engineer = null;
            lookupFailed = true;
        }

        var voterCheck = VoterEligibility.CheckVoter(
            election, engineer, IranTime.Today(now), lookupFailed);

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

        // The roll entry and the sealed ballot, written together. They MUST be one transaction: a
        // roll row without a ballot loses a vote, and a ballot without a roll row allows a second one.
        // This is also the honest limit documented in the design — the pairing is visible in the SQL
        // transaction log to someone holding both the database and the host.
        var voterHash = roll.ComputeHash(election.Id, engineer!.NationalCode);

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

    private static ValidationException Fail(string field, string message)
    {
        var ex = new ValidationException();
        ex.Errors[field] = [message];
        return ex;
    }
}
