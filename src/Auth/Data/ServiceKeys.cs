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

    /// <summary>The grantable services, in display order, with Persian + English names.</summary>
    public static readonly IReadOnlyList<ServiceKey> All =
    [
        new(Mabhas19,     "مبحث ۱۹",           "Mabhas 19"),
        new(Analytics,    "تحلیل داده",         "Analytics"),
        new(MunSanandaj,  "شهرداری سنندج",      "Sanandaj Municipality"),
        new(LandingPanel, "پنل مدیریت لندینگ",  "Landing Panel"),
        new(Plan,         "پلن",                "Plan"),
        new(Walfare,      "سامانه رفاهی مهندسین", "Engineers' Welfare"),
    ];

    // Maps an OIDC client_id -> the product service key it belongs to. admin-web is absent on
    // purpose (role-gated, not service-gated) so it is never blocked by the authorize enforcement.
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

    /// <summary>
    /// Returns the product service key for an OIDC <c>client_id</c>, or <c>null</c> when the client
    /// is not tied to a grantable service (e.g. <c>admin-web</c>) and must therefore never be
    /// blocked by service grants.
    /// </summary>
    public static string? ServiceKeyForClient(string? clientId) =>
        clientId is not null && ClientToKey.TryGetValue(clientId, out var key) ? key : null;

    /// <summary>Returns the canonical key for a (possibly differently-cased) key, or <c>null</c> if invalid.</summary>
    public static string? Normalize(string? key) =>
        All.FirstOrDefault(s => string.Equals(s.Key, key, StringComparison.OrdinalIgnoreCase))?.Key;

    public static bool IsValidKey(string? key) => Normalize(key) is not null;
}
