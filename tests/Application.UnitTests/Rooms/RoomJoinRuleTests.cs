using Mabhas19.Application.Rooms;
using Mabhas19.Domain.Rooms;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Rooms;

/// <summary>
/// Every gate on the way into a meeting, and the order they run in.
/// </summary>
/// <remarks>
/// <para>
/// Step 5's success criterion is «each gate refuses for the right reason», and that is a statement
/// about a pure function — no database, no clock, no HTTP. So it is tested here, exhaustively, rather
/// than through a stack where each case would cost a round trip and where a wrong reason would still
/// look like a correct refusal.
/// </para>
/// <para>
/// The <b>order</b> matters as much as the answers. Somebody who was never getting in must be told
/// that, not made to watch a countdown that will not help them; and «سرویس ویدیو در دسترس نیست» must
/// come last, because it is about us and not about them.
/// </para>
/// <para>
/// Invisible characters are written as <c>\uXXXX</c> escapes throughout, so this file cannot lie about
/// what it is testing.
/// </para>
/// </remarks>
public class RoomJoinRuleTests
{
    private const string Presenter = "5555555555";
    private const string Member = "1234567890";

    /// <summary>U+202E RIGHT-TO-LEFT OVERRIDE — reverses the rendering of everything after it.</summary>
    private const string BidiOverride = "‮";

    /// <summary>U+200B ZERO WIDTH SPACE — invisible, and classified Format like the overrides.</summary>
    private const string ZeroWidthSpace = "​";

    /// <summary>U+2066 LEFT-TO-RIGHT ISOLATE.</summary>
    private const string Isolate = "⁦";

    /// <summary>U+200C ZERO WIDTH NON-JOINER — the Persian نیم‌فاصله, a real part of real names.</summary>
    private const string HalfSpace = "‌";

    private static readonly DateTimeOffset Now = new(2026, 8, 1, 12, 0, 0, TimeSpan.Zero);

    private static Room Presentation(
        RoomJoinMode joinMode = RoomJoinMode.Public,
        int earlyJoinMinutes = 10,
        int maxParticipants = 50) => new()
        {
            Name = "وبینار",
            Slug = "ceo-abcd1234",
            Type = RoomType.Presentation,
            JoinMode = joinMode,
            PresenterUserId = Presenter,
            JoinToken = new string('a', 32),
            StartsAtUtc = Now,
            EarlyJoinMinutes = earlyJoinMinutes,
            MaxParticipants = maxParticipants,
            IsActive = true
        };

    private static Room Meeting(RoomJoinMode joinMode = RoomJoinMode.InviteOnly) => new()
    {
        Name = "جلسه",
        Slug = "ceo-11112222",
        Type = RoomType.Meeting,
        JoinMode = joinMode,
        JoinToken = joinMode == RoomJoinMode.InviteOnly ? null : new string('b', 32),
        StartsAtUtc = Now,
        EarlyJoinMinutes = 10,
        MaxParticipants = 50,
        IsActive = true
    };

    private static JoinDenyReason Check(
        Room? room,
        string? identity = null,
        bool isAdministrator = false,
        bool isInvited = false,
        string? typedName = null,
        DateTimeOffset? now = null,
        int liveCount = 0,
        bool mediaServerReady = true)
        => RoomJoinRules.Check(
            room, identity, isAdministrator, isInvited, typedName,
            now ?? Now, liveCount, mediaServerReady);

    // ── existence ────────────────────────────────────────────────────────────

    [Test]
    public void No_room_is_not_found()
        => Check(null).ShouldBe(JoinDenyReason.NotFound);

    [Test]
    public void A_deleted_room_answers_exactly_like_one_that_never_existed()
    {
        var room = Presentation();
        room.IsDeleted = true;

        // Not a separate reason on purpose. «این جلسه حذف شده» tells a stranger their link was once
        // real, which is one bit more than they are owed.
        Check(room, typedName: "رضا").ShouldBe(JoinDenyReason.NotFound);
    }

    [Test]
    public void A_closed_room_says_so_rather_than_pretending_it_is_missing()
    {
        var room = Presentation();
        room.IsActive = false;

        // Here the caller is owed the truth: an administrator closed it, and that is worth telling
        // somebody who was invited and is now standing at the door.
        Check(room, typedName: "رضا").ShouldBe(JoinDenyReason.Closed);
    }

    // ── the join mode ────────────────────────────────────────────────────────

    [Test]
    public void An_invite_only_meeting_asks_an_anonymous_caller_to_sign_in()
        => Check(Meeting()).ShouldBe(JoinDenyReason.NeedsSignIn);

    [Test]
    public void An_invite_only_meeting_refuses_a_member_who_is_not_on_the_list()
        => Check(Meeting(), identity: Member).ShouldBe(JoinDenyReason.NotInvited);

    [Test]
    public void An_invite_only_meeting_admits_an_invited_member()
        => Check(Meeting(), identity: Member, isInvited: true).ShouldBe(JoinDenyReason.None);

    [Test]
    public void A_private_link_asks_an_anonymous_caller_to_sign_in()
        => Check(Presentation(RoomJoinMode.Private)).ShouldBe(JoinDenyReason.NeedsSignIn);

    [Test]
    public void A_private_link_admits_any_signed_in_member_with_no_invite()
    {
        // Membership itself is the gate. A list here would be a second gate that could disagree with
        // the first, which is worse than either one alone.
        Check(Presentation(RoomJoinMode.Private), identity: Member).ShouldBe(JoinDenyReason.None);
    }

    [Test]
    public void A_public_link_admits_a_stranger_who_typed_a_name()
        => Check(Presentation(), typedName: "رضا احمدی").ShouldBe(JoinDenyReason.None);

    [Test]
    public void A_public_link_asks_for_a_name_when_none_was_typed()
        => Check(Presentation()).ShouldBe(JoinDenyReason.NeedsName);

    [Test]
    public void A_name_made_only_of_characters_that_get_stripped_counts_as_no_name()
    {
        // These survive IsNullOrWhiteSpace but are removed by the sanitizer, so a gate that looked at
        // the raw string would admit a participant with no name at all.
        Check(Presentation(), typedName: BidiOverride + ZeroWidthSpace)
            .ShouldBe(JoinDenyReason.NeedsName);
    }

    // ── who is never gated by the mode ───────────────────────────────────────

    [Test]
    public void The_presenter_is_never_stopped_by_the_join_mode()
    {
        // A presenter locked out of their own presentation is the one failure with no workaround —
        // nobody else can start it for them.
        Check(Presentation(RoomJoinMode.Private), identity: Presenter).ShouldBe(JoinDenyReason.None);
    }

    [Test]
    public void An_administrator_may_enter_an_invite_only_meeting_they_were_not_invited_to()
        => Check(Meeting(), identity: "admin-subject", isAdministrator: true)
            .ShouldBe(JoinDenyReason.None);

    // ── the window ───────────────────────────────────────────────────────────

    [Test]
    public void Nobody_gets_in_before_the_doors_open()
        => Check(Presentation(), typedName: "رضا", now: Now.AddMinutes(-11))
            .ShouldBe(JoinDenyReason.NotOpenYet);

    [Test]
    public void The_early_join_grace_really_opens_the_doors_early()
    {
        // Exactly on the boundary. Ten minutes of grace means ten, not nine.
        Check(Presentation(), typedName: "رضا", now: Now.AddMinutes(-10))
            .ShouldBe(JoinDenyReason.None);
    }

    [Test]
    public void Eligibility_is_decided_before_the_countdown()
    {
        // Someone who is not invited must be told that, not made to wait for a countdown that will
        // change nothing when it ends.
        Check(Meeting(), identity: Member, now: Now.AddHours(-5))
            .ShouldBe(JoinDenyReason.NotInvited);
    }

    // ── capacity ─────────────────────────────────────────────────────────────

    [Test]
    public void A_full_room_turns_an_audience_member_away()
        => Check(Presentation(maxParticipants: 2), typedName: "رضا", liveCount: 2)
            .ShouldBe(JoinDenyReason.Full);

    [Test]
    public void A_full_room_still_admits_the_presenter()
    {
        // An audience that filled the seats before the speaker arrived would be a meeting that
        // cannot happen.
        Check(Presentation(maxParticipants: 2), identity: Presenter, liveCount: 99)
            .ShouldBe(JoinDenyReason.None);
    }

    [Test]
    public void An_unreachable_media_server_reports_zero_inside_and_lets_people_in()
    {
        // The head-count call is fail-soft and answers 0 when it cannot reach the server. That is the
        // right trade: an outage should not lock everybody out of every meeting.
        Check(Presentation(maxParticipants: 1), typedName: "رضا", liveCount: 0)
            .ShouldBe(JoinDenyReason.None);
    }

    // ── us, not them ─────────────────────────────────────────────────────────

    [Test]
    public void An_unconfigured_media_server_is_reported_last()
    {
        // Last on purpose. Someone who was not invited should hear that, not a service message that
        // suggests trying again later.
        Check(Meeting(), identity: Member, mediaServerReady: false)
            .ShouldBe(JoinDenyReason.NotInvited);

        Check(Meeting(), identity: Member, isInvited: true, mediaServerReady: false)
            .ShouldBe(JoinDenyReason.Unavailable);
    }

    [Test]
    public void Every_refusal_has_a_Persian_sentence_and_success_has_none()
    {
        foreach (var reason in Enum.GetValues<JoinDenyReason>())
        {
            var message = RoomJoinRules.Message(reason);

            if (reason == JoinDenyReason.None)
            {
                message.ShouldBeEmpty();
            }
            else
            {
                // A refusal with no words is the complaint this whole enum exists to prevent, and a
                // refusal in English is the same complaint wearing a hat — no enum name may leak out.
                message.ShouldNotBeNullOrWhiteSpace();
                message.ShouldNotContain(c => char.IsAsciiLetter(c));
            }
        }
    }

    // ── guest identity ───────────────────────────────────────────────────────

    [Test]
    public void Two_guests_who_type_the_same_name_are_two_different_participants()
    {
        var ids = Enumerable.Range(0, 200).Select(_ => RoomJoinRules.NewGuestIdentity()).ToList();

        // If the identity were derived from the name, the media server would treat them as one person
        // and disconnect the first when the second arrived.
        ids.Distinct().Count().ShouldBe(ids.Count);
        ids.ShouldAllBe(i => i.StartsWith("guest-") && i.Length == 22);
    }

    [Test]
    public void A_guest_identity_can_never_be_the_presenter()
    {
        var room = Presentation();

        // This is the single flag that makes a public link safe to hand out, and it holds because a
        // guest identity is structurally unable to equal a کد ملی.
        room.MayPublish(RoomJoinRules.NewGuestIdentity()).ShouldBeFalse();
        room.MayPublish(Presenter).ShouldBeTrue();
    }

    // ── the typed name ───────────────────────────────────────────────────────

    [TestCase("رضا احمدی", "رضا احمدی")]
    [TestCase("  رضا   احمدی  ", "رضا احمدی")]
    [TestCase("رضا‮احمدی", "رضااحمدی")]
    [TestCase("رضا​احمدی", "رضااحمدی")]
    [TestCase("رضا⁦احمدی", "رضااحمدی")]
    [TestCase("رضا\nاحمدی", "رضا احمدی")]
    [TestCase("رضا\tاحمدی", "رضا احمدی")]
    [TestCase("", "")]
    [TestCase("   ", "")]
    public void A_typed_name_is_cleaned_before_anybody_else_sees_it(string typed, string expected)
        => RoomJoinRules.SanitizeDisplayName(typed).ShouldBe(expected);

    [Test]
    public void The_Persian_half_space_survives_because_it_is_part_of_real_names()
    {
        // «علی‌رضا» is spelt with a U+200C. It is classified Format, exactly like the overrides above,
        // so a blanket strip would quietly respell people — visually close enough that nobody would
        // report it and it would never be found.
        var name = "علی" + HalfSpace + "رضا احمدی";

        RoomJoinRules.SanitizeDisplayName(name).ShouldBe(name);
    }

    [Test]
    public void A_very_long_name_is_cut_rather_than_pushing_others_off_the_list()
        => RoomJoinRules.SanitizeDisplayName(new string('ا', 500))
            .Length.ShouldBe(RoomJoinRules.MaxDisplayNameLength);

    [Test]
    public void A_bidi_override_cannot_reach_the_participant_list()
    {
        // One guest could otherwise scramble the rendering of the whole list for every viewer, and
        // escaping at render time would not help — this name is also sent to the media server and
        // comes back to every other client.
        var cleaned = RoomJoinRules.SanitizeDisplayName(
            BidiOverride + "مدیر سازمان" + Isolate);

        cleaned.ShouldBe("مدیر سازمان");
    }
}
