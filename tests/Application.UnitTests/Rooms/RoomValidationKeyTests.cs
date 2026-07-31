using Mabhas19.Application.Rooms;
using Mabhas19.Domain.Rooms;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Rooms;

/// <summary>
/// The names a validation error comes back under.
/// </summary>
/// <remarks>
/// <para>
/// This looks like a test of a library, and it is not. The request body an admin posts IS a
/// <see cref="RoomInput"/>; the command that wraps it is a server-side detail. FluentValidation's
/// default for a child validator is to prefix every key with the parent property, which would send
/// <c>Input.Name</c> to a form whose field is called <c>name</c> — the panel would show "this failed"
/// with nothing highlighted, and every field would look fine.
/// </para>
/// <para>
/// Nothing about that is visible in a passing build or a green functional test, so it is pinned here.
/// </para>
/// </remarks>
public class RoomValidationKeyTests
{
    private static RoomInput Valid() => new(
        Name: "جلسهٔ کمیسیون گاز",
        Description: null,
        Type: RoomType.Meeting,
        JoinMode: RoomJoinMode.InviteOnly,
        PresenterUserId: null,
        DateJalali: "1405/05/10",
        StartTime: new TimeOnly(10, 0),
        EarlyJoinMinutes: 10,
        DurationMinutes: 60,
        MaxParticipants: 50);

    private static string[] KeysFor(RoomInput input) =>
        [.. new CreateRoomCommandValidator()
            .Validate(new CreateRoomCommand(input))
            .Errors
            .Select(e => e.PropertyName)];

    [Test]
    public void A_valid_meeting_produces_no_errors()
        => KeysFor(Valid()).ShouldBeEmpty();

    [Test]
    public void An_empty_name_is_reported_as_Name_not_Input_Name()
        => KeysFor(Valid() with { Name = "  " }).ShouldContain(nameof(RoomInput.Name));

    [Test]
    public void A_bad_date_is_reported_as_DateJalali()
        => KeysFor(Valid() with { DateJalali = "1405/13/40" })
            .ShouldContain(nameof(RoomInput.DateJalali));

    [Test]
    public void A_bad_type_and_join_mode_pairing_is_reported_as_JoinMode()
        => KeysFor(Valid() with { JoinMode = RoomJoinMode.Public })
            .ShouldContain(nameof(RoomInput.JoinMode));

    [Test]
    public void No_key_ever_carries_the_command_wrapper()
        => KeysFor(Valid() with { Name = "", DateJalali = "x", MaxParticipants = 0 })
            .ShouldNotContain(k => k.Contains('.'));

    // ── the rules themselves, without a database ──────────────────────────────

    [Test]
    public void A_public_meeting_is_refused()
        => RoomRules.Validate(RoomType.Meeting, RoomJoinMode.Public, null).ShouldNotBeNull();

    [Test]
    public void A_public_presentation_with_a_presenter_is_allowed()
        => RoomRules.Validate(RoomType.Presentation, RoomJoinMode.Public, "u1").ShouldBeNull();

    [Test]
    public void A_presentation_without_a_presenter_is_refused()
        => RoomRules.Validate(RoomType.Presentation, RoomJoinMode.Public, "   ").ShouldNotBeNull();

    [Test]
    public void An_invite_only_presentation_is_refused()
        => RoomRules.Validate(RoomType.Presentation, RoomJoinMode.InviteOnly, "u1").ShouldNotBeNull();

    [Test]
    public void A_new_slug_is_prefixed_and_unique()
    {
        var slugs = Enumerable.Range(0, 200).Select(_ => RoomRules.NewSlug()).ToList();

        slugs.ShouldAllBe(s => s.StartsWith("ceo-") && s.Length == 12);

        // Not proof of randomness — that comes from the source — but it does catch a slug built from a
        // counter or a constant, which would put two meetings in one live room.
        slugs.Distinct().Count().ShouldBe(slugs.Count);
    }

    [Test]
    public void A_new_join_token_is_32_hex_characters_and_unique()
    {
        var tokens = Enumerable.Range(0, 200).Select(_ => RoomRules.NewJoinToken()).ToList();

        tokens.ShouldAllBe(t => t.Length == 32 && t.All(Uri.IsHexDigit));
        tokens.Distinct().Count().ShouldBe(tokens.Count);
    }
}
