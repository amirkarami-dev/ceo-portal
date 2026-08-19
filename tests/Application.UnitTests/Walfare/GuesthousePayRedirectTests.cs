using Shouldly;
using Mabhas19.Application.Walfare.Guesthouses;
using Mabhas19.Application.Walfare.Payments;
using NUnit.Framework;

namespace Mabhas19.Application.UnitTests.Walfare;

/// <summary>
/// Where the bank drops the payer once the payment is decided.
/// </summary>
/// <remarks>
/// This mattered more than it looks. Every payment used to land on <c>/pay/result</c>, which the
/// front end serves INSIDE its RequireAuth guard. A guesthouse payer reaches the gateway from an
/// SMS link and may have no account at all — so they paid real money and were then redirected to
/// a login they could never pass, never seeing the result or their tracking code.
/// </remarks>
public class GuesthousePayRedirectTests
{
    [Test]
    public void Guesthouse_payment_lands_on_the_page_that_needs_no_login()
    {
        HandleIrkCallbackCommandHandler
            .ResultPathFor(InitGuesthousePaymentCommandHandler.TargetType)
            .ShouldBe(HandleIrkCallbackCommandHandler.PublicGuesthouseResultPath);
    }

    [Test]
    public void Pool_payment_keeps_the_signed_in_page()
    {
        // A pool ticket can only be booked while signed in, so its result page may stay guarded.
        HandleIrkCallbackCommandHandler
            .ResultPathFor(InitPoolPaymentCommandHandler.TargetType)
            .ShouldBe(HandleIrkCallbackCommandHandler.SignedInResultPath);
    }

    [TestCase(null)]
    [TestCase("")]
    [TestCase("something-added-later")]
    public void Anything_not_recognised_keeps_the_signed_in_page(string? targetType)
    {
        // Defaulting the other way would quietly expose a future payment kind on a public page.
        HandleIrkCallbackCommandHandler
            .ResultPathFor(targetType)
            .ShouldBe(HandleIrkCallbackCommandHandler.SignedInResultPath);
    }

    [Test]
    public void The_public_page_is_not_under_the_guarded_one()
    {
        // The front end guards everything the signed-in result page sits under. If the public
        // path were ever nested beneath it, the guard would swallow it again.
        HandleIrkCallbackCommandHandler.PublicGuesthouseResultPath
            .ShouldNotStartWith(HandleIrkCallbackCommandHandler.SignedInResultPath);
    }
}
