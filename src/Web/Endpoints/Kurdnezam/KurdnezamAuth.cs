using Mabhas19.Domain.Constants;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>
/// Shared auth helper for the kurdnezam endpoint groups.
/// </summary>
/// <remarks>
/// The landing site is public, so reads are anonymous and only writes are gated. Auth is applied
/// per-route rather than on the group, because a single group mixes both. Every write goes through
/// <see cref="RequireAdmin"/> so the role gate is stated in exactly one place.
/// </remarks>
internal static class KurdnezamAuth
{
    public static RouteHandlerBuilder RequireAdmin(this RouteHandlerBuilder builder)
        => builder.RequireAuthorization(policy => policy.RequireRole(Roles.Administrator));
}
