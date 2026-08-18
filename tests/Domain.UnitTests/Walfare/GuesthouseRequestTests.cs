using Mabhas19.Domain.Walfare;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Domain.UnitTests.Walfare;

public class GuesthouseRequestTests
{
    [Test]
    public void Nights_counts_the_gap_between_the_two_dates()
    {
        var request = new GuesthouseRequest
        {
            CheckInDate = new DateOnly(2026, 8, 18),
            CheckOutDate = new DateOnly(2026, 8, 21)
        };

        request.Nights.ShouldBe(3);
    }

    [Test]
    public void Nights_is_zero_when_arriving_and_leaving_the_same_day()
    {
        var request = new GuesthouseRequest
        {
            CheckInDate = new DateOnly(2026, 8, 18),
            CheckOutDate = new DateOnly(2026, 8, 18)
        };

        request.Nights.ShouldBe(0);
    }

    [Test]
    public void Nights_never_goes_negative_when_the_dates_are_the_wrong_way_round()
    {
        // Validation refuses this at the door, but a row stored under an older rule
        // must not produce a bill for minus two nights.
        var request = new GuesthouseRequest
        {
            CheckInDate = new DateOnly(2026, 8, 21),
            CheckOutDate = new DateOnly(2026, 8, 19)
        };

        request.Nights.ShouldBe(0);
    }

    [Test]
    public void GuestCount_counts_the_applicant_and_companions_but_not_infants()
    {
        var request = new GuesthouseRequest();
        request.Companions.Add(new GuesthouseCompanion { FullName = "الف", IsInfant = false });
        request.Companions.Add(new GuesthouseCompanion { FullName = "ب", IsInfant = false });
        request.Companions.Add(new GuesthouseCompanion { FullName = "ج", IsInfant = true });

        request.GuestCount.ShouldBe(3);
    }
}
