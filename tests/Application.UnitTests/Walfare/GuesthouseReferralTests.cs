using Shouldly;
using Mabhas19.Application.Walfare.Guesthouses;
using Mabhas19.Domain.Walfare;
using NUnit.Framework;

namespace Mabhas19.Application.UnitTests.Walfare;

public class GuesthouseReferralTests
{
    [Test]
    public void Title_is_the_Persian_honorific_for_the_gender()
    {
        GuesthouseReferral.Title(ApplicantGender.Male).ShouldBe("جناب آقای مهندس");
        GuesthouseReferral.Title(ApplicantGender.Female).ShouldBe("سرکار خانم مهندس");
    }

    /// <summary>
    /// The gender select is on the OFFICE's half of the paper form, so a member never fills it in.
    /// Guessing it from a first name is how a letter goes out addressed wrongly.
    /// </summary>
    [Test]
    public void Title_refuses_rather_than_guessing_when_gender_is_unset()
    {
        Should.Throw<InvalidOperationException>(() => GuesthouseReferral.Title(null));
    }
}
