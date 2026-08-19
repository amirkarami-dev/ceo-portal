using Shouldly;
using Mabhas19.Application.Walfare.Guesthouses;
using Mabhas19.Domain.Walfare;
using NUnit.Framework;

namespace Mabhas19.Application.UnitTests.Walfare;

public class GuesthouseTransitionTests
{
    [TestCase(GuesthouseRequestStatus.Submitted, true)]
    [TestCase(GuesthouseRequestStatus.Priced, true)]   // re-pricing before payment is allowed
    [TestCase(GuesthouseRequestStatus.Paid, false)]
    [TestCase(GuesthouseRequestStatus.Rejected, false)]
    [TestCase(GuesthouseRequestStatus.Cancelled, false)]
    public void CanPrice_only_before_money_has_moved(GuesthouseRequestStatus status, bool expected)
        => GuesthouseTransitions.CanPrice(status).ShouldBe(expected);

    [TestCase(GuesthouseRequestStatus.Submitted, true)]
    [TestCase(GuesthouseRequestStatus.Priced, true)]
    [TestCase(GuesthouseRequestStatus.Paid, false)]
    [TestCase(GuesthouseRequestStatus.Rejected, false)]
    public void CanReject_never_after_payment(GuesthouseRequestStatus status, bool expected)
        => GuesthouseTransitions.CanReject(status).ShouldBe(expected);

    [TestCase(GuesthouseRequestStatus.Priced, true)]
    [TestCase(GuesthouseRequestStatus.Submitted, false)]   // nothing to pay yet
    [TestCase(GuesthouseRequestStatus.Paid, false)]        // already paid
    [TestCase(GuesthouseRequestStatus.Rejected, false)]    // refused — a payer already at the bank must not settle it
    [TestCase(GuesthouseRequestStatus.Cancelled, false)]
    public void CanPay_only_from_priced(GuesthouseRequestStatus status, bool expected)
        => GuesthouseTransitions.CanPay(status).ShouldBe(expected);

    [Test]
    public void Mint_produces_a_url_safe_token_of_a_useful_length()
    {
        var token = GuesthouseTokens.Mint();

        token.Length.ShouldBe(43);                       // 32 bytes, base64url, unpadded
        token.ShouldMatch("^[A-Za-z0-9_-]+$");
    }

    [Test]
    public void Mint_does_not_repeat_itself()
    {
        var tokens = Enumerable.Range(0, 200).Select(_ => GuesthouseTokens.Mint()).ToHashSet();

        tokens.Count.ShouldBe(200);
    }

    [Test]
    public void MaxAmountRials_is_a_typo_guard_not_a_business_rule()
        => GuesthouseTransitions.MaxAmountRials.ShouldBe(5_000_000_000L);
}
