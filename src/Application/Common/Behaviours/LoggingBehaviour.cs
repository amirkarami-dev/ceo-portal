using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using MediatR.Pipeline;
using Microsoft.Extensions.Logging;

namespace Mabhas19.Application.Common.Behaviours;

public class LoggingBehaviour<TRequest> : IRequestPreProcessor<TRequest>
    where TRequest : notnull
{
    private readonly ILogger _logger;
    private readonly IUser _user;

    public LoggingBehaviour(ILogger<TRequest> logger, IUser user)
    {
        _logger = logger;
        _user = user;
    }

    public Task Process(TRequest request, CancellationToken cancellationToken)
    {
        // A vote must leave NO trace here. {@UserName} is the کد ملی for engineer accounts, so even
        // "CastVoteCommand <code> <timestamp>" - with no payload at all - is a voter roll that can be
        // matched against the ballot table by arrival order. See ISecretRequest.
        if (request is ISecretRequest)
        {
            return Task.CompletedTask;
        }

        var requestName = typeof(TRequest).Name;
        var userId = _user.Id ?? string.Empty;
        var userName = _user.Name ?? string.Empty;

        // Who did what, but not with which values. The line still shows the request happened and
        // who made it — that is the audit trail — while the payload stays out, because for these
        // it IS the secret: a کد ملی, a mobile, or a payment token that is a bearer credential.
        if (request is ISensitivePayloadRequest)
        {
            _logger.LogInformation("Mabhas19 Request: {Name} {@UserId} {@UserName}",
                requestName, userId, userName);

            return Task.CompletedTask;
        }

        _logger.LogInformation("Mabhas19 Request: {Name} {@UserId} {@UserName} {@Request}",
            requestName, userId, userName, request);

        return Task.CompletedTask;
    }
}
