namespace Mabhas19.Web;

/// <summary>
/// Named rate-limit policies, on top of the global per-IP limiter in
/// <c>DependencyInjection.AddWebServices</c>.
/// </summary>
public static class RateLimitPolicies
{
    /// <summary>
    /// Anything the public can write without an account. The global limiter allows 120 requests a
    /// minute, which is far too generous for a route that accepts files and creates rows: a handful
    /// per hour is plenty for a real person filling in a form.
    /// </summary>
    public const string PublicSubmission = "public-submission";
}
