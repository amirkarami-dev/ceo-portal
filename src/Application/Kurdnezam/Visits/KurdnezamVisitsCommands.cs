using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Domain.Kurdnezam;

namespace Mabhas19.Application.Kurdnezam.Visits;

/// <summary>
/// Records one page view. Deliberately <b>anonymous</b> — this is the public site's counter.
/// </summary>
/// <remarks>
/// <paramref name="SessionId"/> is an opaque id the browser generates and keeps for the session;
/// no IP address or other personal data is stored. It exists only so "online now" can count
/// distinct visitors rather than raw page views.
/// </remarks>
public record TrackKurdnezamVisitCommand(string SessionId, string Path) : IRequest;

public class TrackKurdnezamVisitCommandHandler(IApplicationDbContext context, TimeProvider clock)
    : IRequestHandler<TrackKurdnezamVisitCommand>
{
    public async Task Handle(TrackKurdnezamVisitCommand request, CancellationToken cancellationToken)
    {
        context.KurdnezamVisits.Add(new KurdnezamVisit
        {
            SessionId = request.SessionId,
            Path = request.Path,
            VisitedAt = clock.GetUtcNow()
        });

        await context.SaveChangesAsync(cancellationToken);
    }
}

public class TrackKurdnezamVisitCommandValidator : AbstractValidator<TrackKurdnezamVisitCommand>
{
    public TrackKurdnezamVisitCommandValidator()
    {
        RuleFor(x => x.SessionId).NotEmpty().MaximumLength(64);
        RuleFor(x => x.Path).NotEmpty().MaximumLength(500);
    }
}
