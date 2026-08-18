using Shouldly;
using Mabhas19.Application.Walfare.Guesthouses;
using NUnit.Framework;

namespace Mabhas19.Application.UnitTests.Walfare;

public class GuesthouseRequestValidatorTests
{
    private static GuesthouseRequestInput Valid(params CompanionInput[] companions) => new(
        GuesthouseId: 1,
        FullName: "نام نمونه",
        NationalCode: "1234567890",
        MembershipNumber: "12345",
        Mobile: "09180000000",
        CheckInDate: "1405/05/27",
        CheckOutDate: "1405/05/29",
        Companions: companions);

    private readonly GuesthouseRequestInputValidator _validator = new();

    [Test]
    public void Accepts_a_well_formed_request()
        => _validator.Validate(Valid()).IsValid.ShouldBeTrue();

    [Test]
    public void Refuses_a_checkout_before_the_checkin()
    {
        var input = Valid() with { CheckInDate = "1405/05/29", CheckOutDate = "1405/05/27" };

        _validator.Validate(input).IsValid.ShouldBeFalse();
    }

    [Test]
    public void Refuses_a_stay_of_zero_nights()
        => _validator.Validate(Valid() with { CheckOutDate = "1405/05/27" }).IsValid.ShouldBeFalse();

    [Test]
    public void Refuses_more_than_five_companions()
    {
        var six = Enumerable.Range(0, 6)
            .Select(i => new CompanionInput($"همراه {i}", CompanionRelationInput.Child, false))
            .ToArray();

        _validator.Validate(Valid(six)).IsValid.ShouldBeFalse();
    }

    [Test]
    public void Refuses_more_than_two_infants()
    {
        var three = Enumerable.Range(0, 3)
            .Select(i => new CompanionInput($"کودک {i}", null, true))
            .ToArray();

        _validator.Validate(Valid(three)).IsValid.ShouldBeFalse();
    }

    [Test]
    public void Accepts_five_companions_and_two_infants_together()
    {
        var people = Enumerable.Range(0, 5)
            .Select(i => new CompanionInput($"همراه {i}", CompanionRelationInput.Child, false))
            .Concat(Enumerable.Range(0, 2).Select(i => new CompanionInput($"کودک {i}", null, true)))
            .ToArray();

        _validator.Validate(Valid(people)).IsValid.ShouldBeTrue();
    }

    [Test]
    public void Refuses_a_national_code_that_is_not_ten_digits()
        => _validator.Validate(Valid() with { NationalCode = "12345" }).IsValid.ShouldBeFalse();

    [Test]
    public void Refuses_an_unparseable_jalali_date()
        => _validator.Validate(Valid() with { CheckInDate = "1405/13/40" }).IsValid.ShouldBeFalse();

    /// <summary>
    /// The bug that locked an engineer out of the welfare service: a code pasted from a message
    /// carries an invisible direction mark, which is not whitespace, so Trim() leaves it and a
    /// length check refuses a perfectly good code. Admins will paste into this form.
    /// </summary>
    [Test]
    public void Accepts_a_national_code_pasted_with_an_invisible_mark()
        => _validator.Validate(Valid() with { NationalCode = "1234567890‏" }).IsValid.ShouldBeTrue();

    [Test]
    public void Accepts_persian_digits_in_the_national_code()
        => _validator.Validate(Valid() with { NationalCode = "۱۲۳۴۵۶۷۸۹۰" }).IsValid.ShouldBeTrue();

    // Accepts_a_well_formed_request above already covers a solo applicant: Valid() with no
    // arguments binds Companions to an empty array, not null, so there is no separate
    // "empty companion list" case to add here.

    [Test]
    public void Refuses_a_null_companion_list_with_a_sentence_rather_than_throwing()
    {
        var input = Valid() with { Companions = null! };

        var result = _validator.Validate(input);

        result.IsValid.ShouldBeFalse();
        result.Errors.ShouldContain(e => e.PropertyName == nameof(input.Companions));
    }
}
