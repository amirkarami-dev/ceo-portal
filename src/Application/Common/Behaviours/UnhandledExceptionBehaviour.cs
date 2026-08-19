using Mabhas19.Application.Common.Exceptions;
using Mabhas19.Application.Common.Security;
using Microsoft.Extensions.Logging;
// FluentValidation is a global using and has a ValidationException of its own. The alias pins the
// simple name to OURS — the one ProblemDetailsExceptionHandler turns into a 400.
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Common.Behaviours;

/// <summary>
/// Logs what actually went wrong, and does NOT shout about the things that went right.
/// </summary>
/// <remarks>
/// A request refused for a known reason is not an unhandled exception: the caller already received
/// a 4xx that explains it. Logging those at Error, with a stack trace and the whole request, cost
/// twice — real failures drowned in noise, and ordinary user mistakes wrote user data into the
/// application log. Two real examples from the guesthouse service: a member clicking an EXPIRED
/// payment link recorded their live payment token, and a mistyped کد ملی recorded that person's
/// name, national code, mobile and companions. Both are everyday events, not faults.
/// </remarks>
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
            var isSecret = request is ISecretRequest;

            if (IsExpectedRefusal(ex))
            {
                LogRefusal(requestName, ex, isSecret);
                throw;
            }

            // A failing vote still must not name the voter or echo the chosen candidates, and a
            // failing guesthouse request must not echo a کد ملی or a payment token. The exception
            // itself is logged - losing it would make a real fault undiagnosable - but without
            // {@Request}. See ISecretRequest and ISensitivePayloadRequest.
            if (isSecret || request is ISensitivePayloadRequest)
            {
                _logger.LogError(ex, "Mabhas19 Request: Unhandled Exception for Request {Name}", requestName);
                throw;
            }

            _logger.LogError(ex, "Mabhas19 Request: Unhandled Exception for Request {Name} {@Request}", requestName, request);

            throw;
        }
    }

    /// <summary>
    /// Exceptions that are an ANSWER rather than a fault — <c>ProblemDetailsExceptionHandler</c>
    /// turns each one into a 4xx the caller can read.
    /// </summary>
    /// <remarks>
    /// Keep this list in step with that handler. FluentValidation's own <c>ValidationException</c>
    /// is deliberately NOT here: the handler does not map it, so one escaping really is a 500.
    /// </remarks>
    private static bool IsExpectedRefusal(Exception ex) => ex is
        ValidationException or
        NotFoundException or
        KeyNotFoundException or
        UnauthorizedAccessException or
        ForbiddenAccessException;

    /// <summary>
    /// One Information line. No stack trace, and never the payload.
    /// </summary>
    private void LogRefusal(string requestName, Exception ex, bool isSecret)
    {
        if (!isSecret && ex is ValidationException validation && validation.Errors.Count > 0)
        {
            // Field NAMES only. The values are the entire problem — a national code, a mobile,
            // and a payment token all arrive as validation values.
            _logger.LogInformation(
                "Mabhas19 Request: {Name} refused by validation on {Fields}",
                requestName,
                string.Join(", ", validation.Errors.Keys));
            return;
        }

        // For a secret request even the field names stay out; the name and the timestamp are
        // already as much as ISecretRequest allows.
        _logger.LogInformation(
            "Mabhas19 Request: {Name} refused ({Reason})", requestName, ex.GetType().Name);
    }
}
