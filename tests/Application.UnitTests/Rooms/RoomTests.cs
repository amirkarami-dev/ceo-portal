using Mabhas19.Domain.Rooms;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Rooms;

/// <summary>
/// Who may publish camera, microphone and screen.
/// </summary>
/// <remarks>
/// This is not a UI concern. <c>MayPublish</c> is what the join token is built from, and the media
/// server refuses a track the token does not allow — so a tampered front end cannot turn an audience
/// member's microphone on. Getting this wrong is a stranger speaking over a presentation.
/// </remarks>
public class RoomPublishRightsTests
{
    private static Room Presentation(string presenter) => new()
    {
        Name = "ارائه",
        Slug = "ceo-11112222",
        Type = RoomType.Presentation,
        JoinMode = RoomJoinMode.Public,
        JoinToken = "t",
        PresenterUserId = presenter
    };

    private static Room Meeting() => new()
    {
        Name = "جلسه",
        Slug = "ceo-33334444",
        Type = RoomType.Meeting,
        JoinMode = RoomJoinMode.InviteOnly
    };

    [Test]
    public void In_a_presentation_only_the_presenter_may_publish()
    {
        var room = Presentation("1234567890");

        room.MayPublish("1234567890").ShouldBeTrue();
        room.MayPublish("9999999999").ShouldBeFalse();
    }

    [Test]
    public void A_guest_with_no_identity_may_never_publish_in_a_presentation()
    {
        // Link visitors have a generated identity, but a null must never fall through to "allowed".
        Presentation("1234567890").MayPublish(null).ShouldBeFalse();
    }

    [Test]
    public void The_presenter_match_is_exact()
    {
        // Case- and whitespace-insensitive matching here would let a near-miss identity publish.
        var room = Presentation("1234567890");

        room.MayPublish(" 1234567890").ShouldBeFalse();
        room.MayPublish("1234567890 ").ShouldBeFalse();
    }

    [Test]
    public void A_presentation_with_no_presenter_set_lets_nobody_publish()
    {
        // The database refuses to store this, but the entity must still fail closed if one is ever
        // constructed in memory — a room where everyone can publish is the opposite of the intent.
        var room = Presentation("x");
        room.PresenterUserId = null;

        room.MayPublish("x").ShouldBeFalse();
        room.MayPublish(null).ShouldBeFalse();
    }

    [Test]
    public void In_an_ordinary_meeting_everyone_may_publish()
    {
        var room = Meeting();

        room.MayPublish("anyone").ShouldBeTrue();
        room.MayPublish(null).ShouldBeTrue();
    }
}

/// <summary>When the doors open.</summary>
public class RoomOpeningTests
{
    private static Room At(DateTimeOffset starts, int early = 10) => new()
    {
        Name = "جلسه",
        Slug = "ceo-55556666",
        StartsAtUtc = starts,
        EarlyJoinMinutes = early
    };

    private static readonly DateTimeOffset Now = new(2026, 7, 31, 10, 0, 0, TimeSpan.Zero);

    [Test]
    public void Nobody_may_join_before_the_early_window()
    {
        // Starts at 11:00 with 10 minutes' grace, so 10:49 is still shut.
        At(Now.AddHours(1)).IsOpenAt(Now.AddMinutes(49)).ShouldBeFalse();
    }

    [Test]
    public void The_early_window_lets_people_in_before_the_start()
    {
        // People need to arrive and sort their microphone out before the start, not at it.
        At(Now.AddHours(1)).IsOpenAt(Now.AddMinutes(50)).ShouldBeTrue();
    }

    [Test]
    public void A_meeting_that_has_started_is_open()
        => At(Now.AddHours(-1)).IsOpenAt(Now).ShouldBeTrue();

    [Test]
    public void Zero_grace_means_exactly_the_start_time()
    {
        var room = At(Now, early: 0);

        room.IsOpenAt(Now.AddSeconds(-1)).ShouldBeFalse();
        room.IsOpenAt(Now).ShouldBeTrue();
    }

    [Test]
    public void An_inactive_meeting_is_shut_even_after_its_start_time()
    {
        var room = At(Now.AddHours(-1));
        room.IsActive = false;

        room.IsOpenAt(Now).ShouldBeFalse();
    }

    [Test]
    public void A_deleted_meeting_is_shut()
    {
        var room = At(Now.AddHours(-1));
        room.IsDeleted = true;

        room.IsOpenAt(Now).ShouldBeFalse();
    }

    [Test]
    public void OpensAt_is_the_start_minus_the_grace()
        => At(Now, early: 15).OpensAtUtc.ShouldBe(Now.AddMinutes(-15));
}
