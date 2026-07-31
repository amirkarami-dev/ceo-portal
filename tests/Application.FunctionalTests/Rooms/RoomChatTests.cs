using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.FunctionalTests.Infrastructure;
using Mabhas19.Application.Rooms;
using Mabhas19.Domain.Rooms;
using Microsoft.Extensions.DependencyInjection;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.FunctionalTests.Rooms;

/// <summary>
/// The saved chat, and — mostly — who is allowed to write to it.
/// </summary>
/// <remarks>
/// <para>
/// Step 9's criterion is «a message survives a reload», which is the easy half. The half worth testing
/// is the credential: a guest in a public presentation has <b>no account</b>, so the media token we
/// signed for them is what proves who they are. Get that wrong and a link becomes a way to post as
/// anyone, in any meeting.
/// </para>
/// <para>
/// So these tests attack it: a token from another room, a tampered one, an expired one, none at all,
/// and a body that tries to name its own sender.
/// </para>
/// </remarks>
public class RoomChatTests : TestBase
{
    private const string Presenter = "5555555555";
    private const string Member = "1234567890";
    private const string Outsider = "9876543210";

    private static EngineerInfo Engineer(string nationalCode, string firstName = "آزمون") => new(
        NationalCode: nationalCode,
        FirstName: firstName,
        LastName: "مهندس",
        ReshteCode: "4",
        Mobile: "09120000000",
        MembershipStatus: 0,
        LicenceExpiryJalali: "1499/12/29",
        EducationLevel: "کارشناسی");

    [SetUp]
    public void SeedPeople()
    {
        FunctionalTestSetup.Directory.Add(Engineer(Presenter, "ارائه‌دهنده"));
        FunctionalTestSetup.Directory.Add(Engineer(Member, "عضو"));
        FunctionalTestSetup.Directory.Add(Engineer(Outsider, "غریبه"));
    }

    private static async Task<Room> SeedAsync(
        RoomType type = RoomType.Presentation,
        RoomJoinMode joinMode = RoomJoinMode.Public,
        bool isActive = true)
    {
        var room = new Room
        {
            Name = "وبینار ایمنی گاز",
            Slug = RoomRules.NewSlug(),
            Type = type,
            JoinMode = joinMode,
            JoinToken = RoomRules.NeedsJoinToken(joinMode) ? RoomRules.NewJoinToken() : null,
            PresenterUserId = type == RoomType.Presentation ? Presenter : null,
            PresenterName = type == RoomType.Presentation ? "ارائه‌دهنده مهندس" : null,
            StartsAtUtc = DateTimeOffset.UtcNow.AddMinutes(-5),
            EarlyJoinMinutes = 0,
            MaxParticipants = 50,
            IsActive = isActive,
        };

        await TestApp.AddAsync(room);
        return room;
    }

    /// <summary>Joins as an anonymous guest and returns the media token they were given.</summary>
    private static async Task<RoomJoinDto> JoinAsGuestAsync(Room room, string name = "رضا احمدی")
    {
        TestApp.SignOut();
        return await TestApp.SendAsync(new JoinRoomByLinkCommand(room.JoinToken!, name));
    }

    // ── the criterion ────────────────────────────────────────────────────────

    [Test]
    public async Task A_guest_message_is_saved_and_read_back()
    {
        var room = await SeedAsync();
        var join = await JoinAsGuestAsync(room);

        await TestApp.SendAsync(new SendRoomMessageCommand(room.Id, join.Token, "سلام، صدا خوبه؟"));

        // A separate read, the way a reload would: nothing is carried over from the write.
        var history = await TestApp.SendAsync(new GetRoomMessagesQuery(room.Id, join.Token));

        var line = history.ShouldHaveSingleItem();
        line.Text.ShouldBe("سلام، صدا خوبه؟");
        line.SenderName.ShouldBe("رضا احمدی");
        line.SenderId.ShouldBe(join.Identity);
        line.IsGuest.ShouldBeTrue();
    }

    [Test]
    public async Task History_reads_oldest_first_and_returns_the_LAST_page_of_a_long_meeting()
    {
        var room = await SeedAsync();
        var join = await JoinAsGuestAsync(room);

        for (var i = 1; i <= 5; i++)
        {
            await TestApp.SendAsync(new SendRoomMessageCommand(room.Id, join.Token, $"پیام {i}"));
        }

        var history = await TestApp.SendAsync(new GetRoomMessagesQuery(room.Id, join.Token, Take: 3));

        // The most recent three, in reading order. Taking the FIRST three of a long meeting would show
        // the opening pleasantries instead of what was just said.
        history.Select(m => m.Text).ShouldBe(["پیام 3", "پیام 4", "پیام 5"]);
    }

    // ── the credential ───────────────────────────────────────────────────────

    [Test]
    public async Task No_credential_at_all_is_refused()
    {
        var room = await SeedAsync();
        TestApp.SignOut();

        await Should.ThrowAsync<UnauthorizedAccessException>(
            () => TestApp.SendAsync(new SendRoomMessageCommand(room.Id, null, "سلام")));

        await Should.ThrowAsync<UnauthorizedAccessException>(
            () => TestApp.SendAsync(new GetRoomMessagesQuery(room.Id, null)));
    }

    [Test]
    public async Task A_token_for_ANOTHER_meeting_cannot_post_into_this_one()
    {
        var mine = await SeedAsync();
        var theirs = await SeedAsync();

        var join = await JoinAsGuestAsync(theirs);

        // The token is real, ours, unexpired and correctly signed — and still no good here, because a
        // token names exactly one room. Without this check one public link would be a credential for
        // every meeting on the server.
        await Should.ThrowAsync<Ardalis.GuardClauses.NotFoundException>(
            () => TestApp.SendAsync(new SendRoomMessageCommand(mine.Id, join.Token, "سلام")));

        (await TestApp.CountAsync<RoomMessage>()).ShouldBe(0);
    }

    [Test]
    public async Task A_tampered_token_is_refused()
    {
        var room = await SeedAsync();
        var join = await JoinAsGuestAsync(room);

        // Re-sign nothing, just edit the payload: flip one character of the base64url body. The
        // signature no longer matches, which is the whole security of this scheme.
        var parts = join.Token.Split('.');
        var body = parts[1];
        var tampered = $"{parts[0]}.{body[..^1]}{(body[^1] == 'A' ? 'B' : 'A')}.{parts[2]}";

        await Should.ThrowAsync<UnauthorizedAccessException>(
            () => TestApp.SendAsync(new SendRoomMessageCommand(room.Id, tampered, "سلام")));

        (await TestApp.CountAsync<RoomMessage>()).ShouldBe(0);
    }

    [Test]
    public async Task An_expired_token_is_refused()
    {
        var room = await SeedAsync();
        TestApp.SignOut();

        // Minted through the real service so the signature is genuine — only the clock is against it.
        // A token that outlived its `exp` must stop being a credential, or a link handed out once
        // would be a way into the chat forever.
        using var scope = FunctionalTestSetup.ScopeFactory.CreateScope();
        var tokens = scope.ServiceProvider
            .GetRequiredService<Application.Common.Interfaces.Rooms.IRoomTokenService>();

        var stale = tokens.CreateJoinToken(
            new Application.Common.Interfaces.Rooms.RoomGrant(
                room.Slug, "guest-deadbeefdeadbeef", "رضا", CanPublish: false),
            TimeSpan.FromSeconds(-60));

        await Should.ThrowAsync<UnauthorizedAccessException>(
            () => TestApp.SendAsync(new SendRoomMessageCommand(room.Id, stale, "سلام")));

        (await TestApp.CountAsync<RoomMessage>()).ShouldBe(0);
    }

    [Test]
    public async Task Rubbish_in_the_token_header_is_refused_and_does_not_throw_something_unhandled()
    {
        var room = await SeedAsync();
        TestApp.SignOut();

        foreach (var junk in new[] { "not-a-token", "a.b", "a.b.c", "...", "%%%.%%%.%%%" })
        {
            await Should.ThrowAsync<UnauthorizedAccessException>(
                () => TestApp.SendAsync(new SendRoomMessageCommand(room.Id, junk, "سلام")));
        }
    }

    [Test]
    public async Task A_guest_cannot_rename_themselves_between_messages()
    {
        var room = await SeedAsync();
        var join = await JoinAsGuestAsync(room, "رضا احمدی");

        await TestApp.SendAsync(new SendRoomMessageCommand(room.Id, join.Token, "یک"));
        await TestApp.SendAsync(new SendRoomMessageCommand(room.Id, join.Token, "دو"));

        var history = await TestApp.SendAsync(new GetRoomMessagesQuery(room.Id, join.Token));

        // The name is read out of our own signature, so there is no field to change. The command has
        // no sender, no display name and no guest flag for exactly this reason.
        history.Select(m => m.SenderName).Distinct().ShouldHaveSingleItem().ShouldBe("رضا احمدی");
        history.ShouldAllBe(m => m.IsGuest);
    }

    [Test]
    public async Task A_member_is_never_marked_as_a_guest()
    {
        var room = await SeedAsync(RoomType.Meeting, RoomJoinMode.InviteOnly);
        await TestApp.AddAsync(new RoomInvite { RoomId = room.Id, UserId = Member, UserName = "عضو مهندس" });

        TestApp.RunAsEngineerAsync(Member);
        await TestApp.SendAsync(new SendRoomMessageCommand(room.Id, null, "سلام"));

        var line = (await TestApp.SendAsync(new GetRoomMessagesQuery(room.Id, null))).ShouldHaveSingleItem();

        line.IsGuest.ShouldBeFalse();
        line.SenderId.ShouldBe(Member);
    }

    [Test]
    public async Task A_member_who_may_not_attend_cannot_read_the_chat_either()
    {
        var room = await SeedAsync(RoomType.Meeting, RoomJoinMode.InviteOnly);
        await TestApp.AddAsync(new RoomInvite { RoomId = room.Id, UserId = Member, UserName = "عضو مهندس" });

        TestApp.RunAsEngineerAsync(Member);
        await TestApp.SendAsync(new SendRoomMessageCommand(room.Id, null, "محرمانه"));

        TestApp.RunAsEngineerAsync(Outsider);

        // «Not invited» keeping somebody out of the room while letting them read everything said in it
        // would make the invite list decorative.
        await Should.ThrowAsync<Ardalis.GuardClauses.NotFoundException>(
            () => TestApp.SendAsync(new GetRoomMessagesQuery(room.Id, null)));
    }

    // ── the message itself ───────────────────────────────────────────────────

    [Test]
    public async Task An_empty_message_is_refused()
    {
        var room = await SeedAsync();
        var join = await JoinAsGuestAsync(room);

        await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new SendRoomMessageCommand(room.Id, join.Token, "   ")));
    }

    [Test]
    public async Task A_bidi_override_cannot_reach_the_transcript()
    {
        var room = await SeedAsync();
        var join = await JoinAsGuestAsync(room);

        // U+202E reverses the rendering of everything after it — one message could scramble the whole
        // transcript for every participant. Cleaned where it is accepted, because this text also goes
        // out over the data channel to clients we did not write.
        await TestApp.SendAsync(new SendRoomMessageCommand(room.Id, join.Token, "سلام‮همه"));

        var line = (await TestApp.SendAsync(new GetRoomMessagesQuery(room.Id, join.Token))).ShouldHaveSingleItem();

        line.Text.ShouldBe("سلامهمه");
    }

    [Test]
    public async Task Line_breaks_survive_but_the_Persian_half_space_does_too()
    {
        var room = await SeedAsync();
        var join = await JoinAsGuestAsync(room);

        // A chat message may have paragraphs — unlike a display name. And «علی‌رضا» is spelt with a
        // U+200C, which is classified Format exactly like the overrides above.
        await TestApp.SendAsync(
            new SendRoomMessageCommand(room.Id, join.Token, "خط اول\nعلی‌رضا"));

        var line = (await TestApp.SendAsync(new GetRoomMessagesQuery(room.Id, join.Token))).ShouldHaveSingleItem();

        line.Text.ShouldBe("خط اول\nعلی‌رضا");
    }

    [Test]
    public async Task A_closed_meeting_takes_no_new_messages_but_its_record_stays_readable()
    {
        var room = await SeedAsync();
        var join = await JoinAsGuestAsync(room);
        await TestApp.SendAsync(new SendRoomMessageCommand(room.Id, join.Token, "پیش از بسته شدن"));

        await TestApp.MutateAsync<Room>(r => r.IsActive = false, room.Id);

        var error = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new SendRoomMessageCommand(room.Id, join.Token, "بعد از بسته شدن")));
        error.Errors["Text"].ShouldContain(x => x.Contains("بسته"));

        // Closing the doors is not deleting the record.
        (await TestApp.SendAsync(new GetRoomMessagesQuery(room.Id, join.Token))).ShouldHaveSingleItem();
    }

    [Test]
    public async Task A_deleted_meeting_answers_not_found_rather_than_leaking_its_transcript()
    {
        var room = await SeedAsync();
        var join = await JoinAsGuestAsync(room);
        await TestApp.SendAsync(new SendRoomMessageCommand(room.Id, join.Token, "سلام"));

        await TestApp.RunAsAdministratorAsync();
        await TestApp.SendAsync(new DeleteRoomCommand(room.Id));
        TestApp.SignOut();

        await Should.ThrowAsync<Ardalis.GuardClauses.NotFoundException>(
            () => TestApp.SendAsync(new GetRoomMessagesQuery(room.Id, join.Token)));
    }
}
