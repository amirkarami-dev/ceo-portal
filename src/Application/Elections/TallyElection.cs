using System.Security.Cryptography;
using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.Elections;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Elections;
using Microsoft.EntityFrameworkCore;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Elections;

/// <summary>
/// Open every sealed ballot, count the votes, and publish the result.
/// </summary>
/// <remarks>
/// <para>
/// Deliberately NOT <see cref="ISecretRequest"/>. This is an admin action about the whole election and
/// reveals nothing about any individual, so it SHOULD be logged and attributed — the design asks for
/// publishing to be traceable, and <c>Election</c> is auditable so <c>LastModifiedBy</c> records who
/// ran it.
/// </para>
/// <para>
/// Re-running is allowed and is how a recount works during the 30-day retention window. The digest
/// makes that safe: if the recomputed digest differs from the stored one, the ballots changed since
/// the first tally, and that is a hard failure rather than a new result.
/// </para>
/// </remarks>
[Authorize(Roles = Roles.Administrator)]
public record TallyElectionCommand(int Id) : IRequest<TallyOutcome>;

public sealed record TallyOutcome(
    int BallotsCounted,
    int VotesCounted,
    bool WasRecount,
    /// <summary>Hex of the digest over the sealed ballots, for an admin to record externally.</summary>
    string ResultDigest);

public class TallyElectionCommandHandler(
    IApplicationDbContext context,
    IBallotSealer sealer,
    TimeProvider clock) : IRequestHandler<TallyElectionCommand, TallyOutcome>
{
    public async Task<TallyOutcome> Handle(TallyElectionCommand request, CancellationToken cancellationToken)
    {
        if (!sealer.IsConfigured)
        {
            throw Fail("Configuration", "کلید رأی‌گیری تنظیم نشده است؛ شمارش ممکن نیست");
        }

        var election = await context.Elections
            .FirstOrDefaultAsync(e => e.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, election);

        if (election.Status == ElectionStatus.Cancelled)
        {
            throw Fail("Status", "این انتخابات لغو شده است");
        }

        if (election.Status != ElectionStatus.Published)
        {
            throw Fail("Status", "این انتخابات منتشر نشده است");
        }

        // Never tally an open election. A partial count leaking mid-vote would tell later voters which
        // way it is going, which changes the election.
        if (clock.GetUtcNow() < election.ClosesAtUtc)
        {
            throw Fail("ClosesAtUtc", "تا پایان زمان رأی‌گیری، شمارش ممکن نیست");
        }

        if (election.BallotsPurgedAt is not null)
        {
            // After the purge the ballots are gone, so a recount is impossible by design. Saying so
            // plainly beats returning a count of zero.
            throw Fail("BallotsPurgedAt",
                "برگه‌های رأی این انتخابات پاک شده‌اند و شمارش مجدد امکان‌پذیر نیست");
        }

        // Ordered by BallotId so the digest is deterministic regardless of how SQL Server returns rows.
        var ballots = await context.ElectionBallots
            .AsNoTracking()
            .Where(b => b.ElectionId == election.Id)
            .OrderBy(b => b.BallotId)
            .ToListAsync(cancellationToken);

        var digest = ComputeDigest(ballots);
        var wasRecount = election.ResultDigest is not null;

        if (wasRecount && !election.ResultDigest!.SequenceEqual(digest))
        {
            // The set of sealed ballots is not what it was at the first tally. Something added, removed
            // or edited a ballot. Refuse to publish a new number over the old one — an election whose
            // ballots changed after counting needs a human, not a recount.
            throw Fail("ResultDigest",
                "برگه‌های رأی نسبت به شمارش قبلی تغییر کرده‌اند. شمارش متوقف شد؛ با مدیر سامانه تماس بگیرید");
        }

        var tally = new Dictionary<int, int>();
        var votesCounted = 0;

        foreach (var ballot in ballots)
        {
            // A ballot that will not open is an integrity failure, not a spoiled vote. Deliberately NOT
            // caught: skipping it would silently drop somebody's vote and still publish a total that
            // looked complete.
            var choices = sealer.Open(
                election.Id, ballot.KeyVersion, election.MaxSelections, ballot.Sealed);

            foreach (var candidateId in choices)
            {
                tally[candidateId] = tally.GetValueOrDefault(candidateId) + 1;
                votesCounted++;
            }
        }

        // A vote for a candidate that is not on this ballot cannot happen — the cast validates ids and
        // the freeze rule stops the candidate list changing after voting opens. If it ever does, stop:
        // it means one of those two guarantees failed.
        var knownIds = await context.ElectionCandidates
            .AsNoTracking()
            .Where(c => c.ElectionId == election.Id)
            .Select(c => c.Id)
            .ToListAsync(cancellationToken);

        var unknown = tally.Keys.Except(knownIds).ToList();
        if (unknown.Count > 0)
        {
            throw Fail("Ballots",
                "برگه‌های رأی شامل کاندیدای نامعتبر هستند. شمارش متوقف شد؛ با مدیر سامانه تماس بگیرید");
        }

        election.ResultDigest = digest;
        election.TalliedAt = clock.GetUtcNow();
        await context.SaveChangesAsync(cancellationToken);

        return new TallyOutcome(
            ballots.Count,
            votesCounted,
            wasRecount,
            Convert.ToHexString(digest));
    }

    /// <summary>
    /// SHA-256 over every ballot's id and sealed bytes, in BallotId order.
    /// </summary>
    /// <remarks>
    /// This is what proves the published numbers came from these ballots. It must survive the 30-day
    /// purge untouched — after the ballots are deleted, the digest is the only evidence left, so the
    /// purge must never recompute or clear it.
    /// </remarks>
    /// <remarks>Public because the digest itself is non-secret — it is returned as hex in the API.</remarks>
    public static byte[] ComputeDigest(IEnumerable<ElectionBallot> ballots)
    {
        using var sha = SHA256.Create();

        foreach (var b in ballots.OrderBy(b => b.BallotId))
        {
            var id = b.BallotId.ToByteArray();
            sha.TransformBlock(id, 0, id.Length, null, 0);
            sha.TransformBlock(b.Sealed, 0, b.Sealed.Length, null, 0);
        }

        sha.TransformFinalBlock([], 0, 0);
        return sha.Hash!;
    }

    private static ValidationException Fail(string field, string message)
    {
        var ex = new ValidationException();
        ex.Errors[field] = [message];
        return ex;
    }
}
