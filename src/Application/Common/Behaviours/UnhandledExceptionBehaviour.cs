using Mabhas19.Application.Common.Security;
using Microsoft.Extensions.Logging;

namespace Mabhas19.Application.Common.Behaviours;

public class UnhandledExceptionBehaviour<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    private readonly ILogger<TRequest> _logger;

    public UnhandledExceptionBehaviour(ILogger<TRequest> logger)
    {
        _logger = logger;
    }

    public async Task<TResponse> Handle(TRequest request, RequestHandlerDelegate<TResponse> next, CancellationToken cancellationToken)
    {
        try
        {
            return await next();
        }
        catch (Exception ex)
        {
            var requestName = typeof(TRequest).Name;

            // A failing vote still must not name the voter or echo the chosen candidates. The
            // exception itself is logged - losing the error would make a broken election
            // undiagnosable - but without {@Request}. See ISecretRequest.
            if (request is ISecretRequest)
            {
                _logger.LogError(ex, "Mabhas19 Request: Unhandled Exception for Request {Name}", requestName);
                throw;
            }

            _logger.LogError(ex, "Mabhas19 Request: Unhandled Exception for Request {Name} {@Request}", requestName, request);

            throw;
        }
    }
}
