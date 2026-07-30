using System.Diagnostics;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Microsoft.Extensions.Logging;

namespace Mabhas19.Application.Common.Behaviours;

public class PerformanceBehaviour<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly Stopwatch _timer;
    private readonly ILogger<TRequest> _logger;
    private readonly IUser _user;

    public PerformanceBehaviour(
        ILogger<TRequest> logger,
        IUser user)
    {
        _timer = new Stopwatch();

        _logger = logger;
        _user = user;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        _timer.Start();

        var response = await next();

        _timer.Stop();

        var elapsedMilliseconds = _timer.ElapsedMilliseconds;

        // Same reasoning as LoggingBehaviour: a slow-request warning naming the user is still a
        // roll entry, and a vote is exactly the request most likely to be slow (an external
        // membership lookup plus crypto), so this branch would fire often.
        if (elapsedMilliseconds > 500 && request is not ISecretRequest)
        {
            var requestName = typeof(TRequest).Name;
            var userId = _user.Id ?? string.Empty;
            var userName = _user.Name ?? string.Empty;

            _logger.LogWarning("Mabhas19 Long Running Request: {Name} ({ElapsedMilliseconds} milliseconds) {@UserId} {@UserName} {@Request}",
                requestName, elapsedMilliseconds, userId, userName, request);
        }

        return response;
    }
}
