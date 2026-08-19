using Shouldly;
using Mabhas19.Application.Walfare.Guesthouses;
using NUnit.Framework;

namespace Mabhas19.Application.UnitTests.Walfare;

public class GuesthouseSmsTextTests
{
    [Test]
    public void Message_names_the_guesthouse_the_amount_and_the_link()
    {
        var text = GuesthouseSmsText.Build(
            "مهمانسرای سنندج", 2_500_000, "https://refahi.kurdnezam.ir/pay/guesthouse/abc");

        text.ShouldContain("مهمانسرای سنندج");
        text.ShouldContain("https://refahi.kurdnezam.ir/pay/guesthouse/abc");
        text.ShouldContain("۲۵۰٬۰۰۰");   // rials rendered as tomans, grouped, Persian digits
    }

    [Test]
    public void Message_stays_short_enough_not_to_bill_as_several_parts()
    {
        var text = GuesthouseSmsText.Build("مهمانسرای سنندج", 2_500_000, "https://x.ir/p/abc");

        // Persian is two bytes per character in UTF-8 and long messages bill per part.
        text.Length.ShouldBeLessThan(200);
    }

    [Test]
    public void Message_carries_no_personal_detail()
    {
        var text = GuesthouseSmsText.Build("مهمانسرای سنندج", 2_500_000, "https://x.ir/p/abc");

        // Anyone can read an SMS over a shoulder; the page behind the link is already anonymous.
        text.ShouldNotContain("کد ملی");
        text.ShouldNotContain("عضویت");
    }

    [Test]
    public void MaxLifetime_is_thirty_days()
    {
        // The absolute ceiling a re-sent payment link may ever be pushed to, however many times
        // it is re-sent. Pinned so nobody loosens it while touching Lifetime nearby.
        GuesthouseTokens.MaxLifetime.ShouldBe(TimeSpan.FromDays(30));
    }
}
