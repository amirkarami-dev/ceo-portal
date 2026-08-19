using Shouldly;
using Mabhas19.Application.Walfare.Guesthouses;
using Mabhas19.Domain.Walfare;
using NUnit.Framework;

namespace Mabhas19.Application.UnitTests.Walfare;

/// <summary>
/// Which welfare service is allowed to hold a guesthouse.
/// </summary>
/// <remarks>
/// The member's services page routes by <c>WelfareService.Type</c>, so a guesthouse attached to a
/// pool service is unreachable: the member is sent to the booking calendar and never sees it, and
/// nothing reports a problem. The admin picker already filters the list, but a picker is a
/// convenience — somebody calling the API directly, or a future screen, needs the rule itself.
/// </remarks>
public class GuesthouseServiceRuleTests
{
    [Test]
    public void A_guesthouse_service_may_hold_one()
    {
        GuesthouseServiceRule.Reject(WelfareServiceType.Guesthouse).ShouldBeNull();
    }

    [Test]
    public void A_pool_service_may_not()
    {
        GuesthouseServiceRule
            .Reject(WelfareServiceType.PoolTicket)
            .ShouldBe("مهمانسرا فقط زیر خدمتی از نوع «مهمانسرا» تعریف می‌شود.");
    }

    [Test]
    public void A_service_that_does_not_exist_is_refused_with_its_own_sentence()
    {
        // Not the same message as "wrong type": this used to reach the database and come back as a
        // foreign-key violation, i.e. a 500 with nothing next to the box the admin got wrong.
        GuesthouseServiceRule.Reject(null).ShouldBe("خدمت انتخاب‌شده یافت نشد.");
    }

    [Test]
    public void Every_service_type_is_decided_explicitly()
    {
        // Adding a third WelfareServiceType must be a deliberate choice here, not a silent
        // inheritance of whatever the default arm happens to do.
        foreach (var type in Enum.GetValues<WelfareServiceType>())
        {
            var rejected = GuesthouseServiceRule.Reject(type);
            if (type == WelfareServiceType.Guesthouse) rejected.ShouldBeNull();
            else rejected.ShouldNotBeNullOrWhiteSpace();
        }
    }
}
