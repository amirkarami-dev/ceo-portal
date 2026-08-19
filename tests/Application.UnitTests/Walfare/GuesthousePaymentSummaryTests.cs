using System.Reflection;
using Shouldly;
using Mabhas19.Application.Walfare.Guesthouses;
using Mabhas19.Domain.Walfare;
using NUnit.Framework;

namespace Mabhas19.Application.UnitTests.Walfare;

public class GuesthousePaymentSummaryTests
{
    /// <summary>
    /// The link goes out by SMS and can be forwarded to anyone. Whoever opens it must learn what
    /// they are paying for and nothing about whom the stay is for. This test is the guard: adding
    /// an identifier to the DTO breaks it on purpose.
    /// </summary>
    [Test]
    public void Summary_carries_no_identifying_field()
    {
        var names = typeof(GuesthousePaymentSummaryDto)
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Select(p => p.Name)
            .ToArray();

        names.ShouldBe(new[]
        {
            "GuesthouseName", "GuesthouseCity", "CheckInDateJalali", "CheckOutDateJalali",
            "Nights", "GuestCount", "AmountRials", "Payable", "Reason"
        }, ignoreOrder: true);
    }

    [Test]
    public void Payable_when_priced_and_unexpired()
    {
        var now = DateTimeOffset.UtcNow;

        GuesthousePaymentRules
            .Evaluate(GuesthouseRequestStatus.Priced, now.AddDays(1), now)
            .Payable.ShouldBeTrue();
    }

    [Test]
    public void An_expired_link_refuses_rather_than_opening_the_gateway()
    {
        var now = DateTimeOffset.UtcNow;

        var result = GuesthousePaymentRules.Evaluate(
            GuesthouseRequestStatus.Priced, now.AddMinutes(-1), now);

        result.Payable.ShouldBeFalse();
        result.Reason.ShouldContain("منقضی");
    }

    [Test]
    public void An_already_paid_link_says_so_instead_of_charging_twice()
    {
        var now = DateTimeOffset.UtcNow;

        var result = GuesthousePaymentRules.Evaluate(
            GuesthouseRequestStatus.Paid, now.AddDays(1), now);

        result.Payable.ShouldBeFalse();
        result.Reason.ShouldContain("پرداخت");
    }

    [Test]
    public void An_unpriced_request_is_not_payable()
    {
        var now = DateTimeOffset.UtcNow;

        GuesthousePaymentRules
            .Evaluate(GuesthouseRequestStatus.Submitted, null, now)
            .Payable.ShouldBeFalse();
    }
}
