using Mabhas19.Auth.Data;

// Deliberately OUTSIDE the Mabhas19.Auth.FunctionalTests namespace: the [SetUpFixture] there boots
// the whole Aspire host, and these are pure assertions about a static table. NUnit scopes a
// SetUpFixture to its own namespace and descendants, so living in a sibling namespace keeps these
// fast. Run them alone with:  dotnet test tests/Auth.FunctionalTests --filter FullyQualifiedName~UnitChecks
namespace Mabhas19.Auth.UnitChecks;

/// <summary>
/// The client → service-key tables decide who is refused at the IdP. Every entry (and every
/// deliberate absence) is load-bearing, so they are asserted rather than trusted to review.
/// </summary>
[TestFixture]
public class ServiceKeyMappingTests
{
    // ── gated for everyone ───────────────────────────────────────────────────

    [TestCase("mabhas19-web",     ServiceKeys.Mabhas19)]
    [TestCase("mabhas19-mobile",  ServiceKeys.Mabhas19)]
    [TestCase("analytics-web",    ServiceKeys.Analytics)]
    [TestCase("mun-sanandaj-web", ServiceKeys.MunSanandaj)]
    [TestCase("landing-panel",    ServiceKeys.LandingPanel)]
    [TestCase("plan-web",         ServiceKeys.Plan)]
    [TestCase("walfare-web",      ServiceKeys.Walfare)]
    public void Gates_everyone(string clientId, string expected) =>
        ServiceKeys.ServiceKeyForClient(clientId).ShouldBe(expected);

    // ── gated for administrators only ────────────────────────────────────────

    /// <summary>
    /// These must NOT gate an engineer. Every engineer provisioned before the election service
    /// existed carries ["walfare"], so gating election-web for them would take away their ballot;
    /// meeting attendance is decided by the invite, not a grant; and vms-web is admin-only anyway.
    /// </summary>
    [TestCase("election-web", ServiceKeys.Election)]
    [TestCase("room-web",     ServiceKeys.Room)]
    [TestCase("vms-web",      ServiceKeys.Vms)]
    public void Gates_administrators_only(string clientId, string expected)
    {
        ServiceKeys.ServiceKeyForClient(clientId).ShouldBeNull();
        ServiceKeys.AdminGatedServiceKeyForClient(clientId).ShouldBe(expected);
    }

    // ── gated for nobody ─────────────────────────────────────────────────────

    /// <summary>
    /// admin-web is the way back in for an administrator whose grants were narrowed by mistake.
    /// Gating it in either table makes that mistake unrecoverable without a database edit.
    /// </summary>
    [Test]
    public void Admin_panel_is_never_gated()
    {
        ServiceKeys.ServiceKeyForClient("admin-web").ShouldBeNull();
        ServiceKeys.AdminGatedServiceKeyForClient("admin-web").ShouldBeNull();
    }

    [Test]
    public void Unknown_and_null_clients_are_never_gated()
    {
        ServiceKeys.ServiceKeyForClient("no-such-client").ShouldBeNull();
        ServiceKeys.AdminGatedServiceKeyForClient("no-such-client").ShouldBeNull();
        ServiceKeys.ServiceKeyForClient(null).ShouldBeNull();
        ServiceKeys.AdminGatedServiceKeyForClient(null).ShouldBeNull();
    }

    // ── the grantable list ───────────────────────────────────────────────────

    /// <summary>
    /// A key must be in <c>All</c> before anyone can hold it: <c>ServiceAccessStore.ReplaceAsync</c>
    /// normalises on write and silently drops anything unknown. Mapping a client to a key that is
    /// not grantable would refuse everyone with grants and give no way to fix it.
    /// </summary>
    [Test]
    public void Every_mapped_key_is_grantable()
    {
        string[] clients =
        [
            "mabhas19-web", "mabhas19-mobile", "analytics-web", "mun-sanandaj-web",
            "landing-panel", "plan-web", "walfare-web", "election-web", "room-web", "vms-web"
        ];

        foreach (var client in clients)
        {
            var key = ServiceKeys.ServiceKeyForClient(client)
                      ?? ServiceKeys.AdminGatedServiceKeyForClient(client);

            key.ShouldNotBeNull($"{client} maps to nothing");
            ServiceKeys.IsValidKey(key).ShouldBeTrue($"{client} maps to '{key}', which is not in All");
        }
    }

    [Test]
    public void Vms_is_grantable_so_cameras_can_be_handed_to_one_admin()
    {
        ServiceKeys.IsValidKey(ServiceKeys.Vms).ShouldBeTrue();
        ServiceKeys.Normalize("VMS").ShouldBe(ServiceKeys.Vms);
    }

    [Test]
    public void A_client_is_never_in_both_tables()
    {
        string[] clients =
        [
            "mabhas19-web", "mabhas19-mobile", "analytics-web", "mun-sanandaj-web",
            "landing-panel", "plan-web", "walfare-web", "election-web", "room-web",
            "vms-web", "admin-web"
        ];

        foreach (var client in clients)
        {
            var both = ServiceKeys.ServiceKeyForClient(client) is not null
                       && ServiceKeys.AdminGatedServiceKeyForClient(client) is not null;

            both.ShouldBeFalse($"{client} is in both tables; which one wins is then an accident");
        }
    }

    [Test]
    public void Keys_are_matched_case_insensitively()
    {
        ServiceKeys.ServiceKeyForClient("WALFARE-WEB").ShouldBe(ServiceKeys.Walfare);
        ServiceKeys.AdminGatedServiceKeyForClient("VMS-Web").ShouldBe(ServiceKeys.Vms);
    }
}
