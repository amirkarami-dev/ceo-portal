using Mabhas19.Application.Common;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Elections;

/// <summary>
/// The discipline code → Persian name mapping used by the voting cards and (in step 8) the Bale bot.
/// </summary>
public class ReshteNamesTests
{
    [Test]
    public void Every_known_code_resolves_to_its_persian_name()
    {
        ReshteNames.Describe("1").ShouldBe("معماری");
        ReshteNames.Describe("4").ShouldBe("مکانیک");
        ReshteNames.Describe("7").ShouldBe("ترافیک");
    }

    [Test]
    public void There_are_exactly_seven_disciplines()
    {
        // سازه / ژئوتکنیک / زه‌کشی / سازه نگهبان are صلاحیت, not رشته, and no column in the org DB
        // carries them. If this number ever changes, the admin picker in election-web must change too.
        ReshteNames.All.Count().ShouldBe(7);
    }

    [Test]
    public void Persian_digits_resolve_the_same_as_latin_ones()
    {
        // Codes reach us from Persian keyboards and from the org DB in different digit sets.
        ReshteNames.Describe("۴").ShouldBe("مکانیک");
    }

    [Test]
    public void A_blank_code_is_null_rather_than_an_empty_label()
    {
        // The card hides the row entirely rather than rendering an empty tag.
        ReshteNames.Describe(null).ShouldBeNull();
        ReshteNames.Describe("").ShouldBeNull();
        ReshteNames.Describe("   ").ShouldBeNull();
    }

    [Test]
    public void An_unknown_code_degrades_to_a_readable_label_rather_than_disappearing()
    {
        // Codes are stored as opaque strings so an eighth discipline needs no migration. Dropping the
        // field silently would hide that an unmapped code is in use.
        ReshteNames.Describe("9").ShouldBe("رشتهٔ 9");
    }
}
