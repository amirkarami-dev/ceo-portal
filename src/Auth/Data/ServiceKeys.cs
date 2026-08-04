namespace Mabhas19.Auth.Data;

/// <summary>
/// One grantable product-level service, with its display names (Persian + English).
/// </summary>
public sealed record ServiceKey(string Key, string NameFa, string NameEn);

/// <summary>
/// The product-level services a user can be granted access to. Each service maps to one or more
/// OIDC <c>client_id</c>s. Enforcement happens at the authorize step in
/// <c>AuthorizationController</c>: the incoming <c>client_id</c> is mapped to a service key, and a
/// user with a non-empty grant list is denied any service not in it (empty list = grandfathered,
/// all services allowed). The <c>admin-web</c> client is intentionally NOT a grantable service —
/// it is gated by the <c>Administrator</c> role only, so it maps to no key and is never blocked here.
/// </summary>
public static class ServiceKeys
{
    public const string Mabhas19     = "mabhas19";
    public const string Analytics    = "analytics";
    public const string MunSanandaj  = "mun-sanandaj";
    public const string LandingPanel = "landing-panel";
    public const string Plan         = "plan";
    public const string Walfare      = "walfare";
    public const string Election     = "election";
    public const string Room         = "room";
    public const string Vms          = "vms";

    /// <summary>
    /// The grantable services, in display order, with Persian + English names.
    /// </summary>
    /// <remarks>
    /// Membership here is what makes a key <b>storable</b>: <c>ServiceAccessStore.ReplaceAsync</c>
    /// normalises on write and silently drops anything not in this list, so a key must land here
    /// before anyone can be granted it. It is also what the admin UI offers as checkboxes
    /// (<c>AdminController.GetServices</c>), which is why <c>vms</c> appears even though only an
    /// administrator can use it — the checkbox is inert on an engineer's row.
    /// </remarks>
    public static readonly IReadOnlyList<ServiceKey> All =
    [
        new(Mabhas19,     "مبحث ۱۹",           "Mabhas 19"),
        new(Analytics,    "تحلیل داده",         "Analytics"),
        new(MunSanandaj,  "شهرداری سنندج",      "Sanandaj Municipality"),
        new(LandingPanel, "پنل مدیریت لندینگ",  "Landing Panel"),
        new(Plan,         "پلن",                "Plan"),
        new(Walfare,      "سامانه رفاهی مهندسین", "Engineers' Welfare"),
        new(Election,     "سامانه انتخابات",     "Elections"),
        new(Room,         "جلسات آنلاین",        "Meetings"),
        new(Vms,          "دوربین‌های نظارتی",    "Cameras"),
    ];

    // Maps an OIDC client_id -> the product service key it belongs to, for EVERYONE. admin-web is
    // absent on purpose (role-gated, not service-gated) so it is never blocked by the authorize
    // enforcement — an administrator whose grants were narrowed must always keep a way back in to
    // widen them again.
    //
    // election-web, room-web and vms-web are absent here on purpose too, and are gated for
    // administrators only via AdminGatedClientToKey below. See the comment there.
    private static readonly IReadOnlyDictionary<string, string> ClientToKey =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["mabhas19-web"]     = Mabhas19,
            ["mabhas19-mobile"]  = Mabhas19,
            ["analytics-web"]    = Analytics,
            ["mun-sanandaj-web"] = MunSanandaj,
            ["landing-panel"]    = LandingPanel,
            ["plan-web"]         = Plan,
            ["walfare-web"]      = Walfare,
        };

    // Gated for ADMINISTRATORS ONLY. These three clients must never gate an engineer:
    //
    // - Every engineer provisioned before the election service existed carries a grant list of
    //   ["walfare"], and a fresh one carries exactly the single service they signed in through
    //   (EngineerLogin). Gating election-web for them would refuse all of them at authorize and
    //   silently disenfranchise them — eligibility for an election is decided per election by the
    //   API from the org directory, and a membership list in the IdP is not allowed to become a
    //   second, invisible voter roll.
    // - Who may attend a meeting is the invite list on that meeting, or the link. An engineer
    //   carrying ["walfare"] who is invited to a جلسه must be able to sign in and attend it.
    // - vms-web is admin-only in its own right (RequireAdmin in the SPA, RequireRole on both API
    //   groups), so gating it for engineers would only swap a /403 page for an IdP error.
    //
    // For an ADMINISTRATOR with a non-empty grant list, all three are gated, because "assign a
    // service to an admin and they get only that service" is the whole point of the feature.
    //
    // ⚠ TRAP: this splits on ROLE, not on how the account logs in. Today no administrator is an
    // engineer (all six have a PasswordHash; all 413 granted users have none), so nobody loses a
    // ballot. The day you give Administrator to an engineer's account, grant them `election` and
    // `room` too, or you take away their vote and their meetings.
    private static readonly IReadOnlyDictionary<string, string> AdminGatedClientToKey =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["election-web"] = Election,
            ["room-web"]     = Room,
            ["vms-web"]      = Vms,
        };

    /// <summary>
    /// Returns the product service key for an OIDC <c>client_id</c>, or <c>null</c> when the client
    /// is not tied to a grantable service (e.g. <c>admin-web</c>) and must therefore never be
    /// blocked by service grants.
    /// </summary>
    public static string? ServiceKeyForClient(string? clientId) =>
        clientId is not null && ClientToKey.TryGetValue(clientId, out var key) ? key : null;

    /// <summary>
    /// Returns the service key for a client that gates <b>administrators only</b>, or <c>null</c>.
    /// Call this only after establishing that the user holds administrative powers — passing an
    /// engineer through it would disenfranchise them. See the comment on
    /// <c>AdminGatedClientToKey</c>.
    /// </summary>
    public static string? AdminGatedServiceKeyForClient(string? clientId) =>
        clientId is not null && AdminGatedClientToKey.TryGetValue(clientId, out var key) ? key : null;

    /// <summary>Returns the canonical key for a (possibly differently-cased) key, or <c>null</c> if invalid.</summary>
    public static string? Normalize(string? key) =>
        All.FirstOrDefault(s => string.Equals(s.Key, key, StringComparison.OrdinalIgnoreCase))?.Key;

    public static bool IsValidKey(string? key) => Normalize(key) is not null;
}
