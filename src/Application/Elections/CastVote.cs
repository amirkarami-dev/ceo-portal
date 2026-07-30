using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Elections;

/// <summary>
/// Cast one ballot from the web.
/// </summary>
/// <remarks>
/// <para>
/// <b>There is deliberately NO voter identifier on this command.</b> This repo binds whole commands
/// straight from the request body (see <c>Projects.CreateProject</c>), so a
/// <c>VoterNationalCode</c> parameter here would let any signed-in engineer vote as anyone whose کد ملی
/// they know — and کد ملی is not secret in Iran. Identity comes from <see cref="IUser"/> only.
/// An architecture test enforces this; do not add a field for the bot's convenience — the bot has its
/// own path into <see cref="IBallotCaster"/> and does not need one here.
/// </para>
/// <para>
/// <see cref="ISecretRequest"/> keeps this out of the logs entirely — for engineer accounts the
/// username IS the کد ملی, so one log line plus the ballot table's arrival order reveals how each
/// person voted with no key needed.
/// </para>
/// <para>
/// The rules themselves are in <see cref="BallotCaster"/>, shared with the Bale bot. Both channels must
/// enforce the same conditions or the one-vote guarantee is only as strong as the weaker one.
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

public class CastVoteCommandHandler(IBallotCaster caster, IUser user)
    : IRequestHandler<CastVoteCommand, CastVoteResult>
{
    public Task<CastVoteResult> Handle(CastVoteCommand request, CancellationToken cancellationToken)
    {
        // Engineer accounts use the کد ملی as the username (same as the welfare flow).
        var nationalCode = user.Name;

        // Checked here rather than in the caster because this message is about the ACCOUNT: a
        // non-engineer account, or a malformed username, is a web-login problem and the bot must never
        // show it. Letting VoterRoll.ComputeHash throw instead would surface as a 500 and, in the ballot
        // list, would break the whole page for that user rather than one election.
        if (!BallotCaster.IsWellFormedNationalCode(nationalCode))
        {
            var ex = new ValidationException();
            ex.Errors["Voter"] = ["حساب کاربری شما برای رأی دادن معتبر نیست"];
            throw ex;
        }

        return caster.CastAsync(nationalCode!, request.ElectionId, request.CandidateIds, cancellationToken);
    }
}
