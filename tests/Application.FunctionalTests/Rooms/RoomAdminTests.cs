using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.FunctionalTests.Infrastructure;
using Mabhas19.Application.Rooms;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Rooms;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.FunctionalTests.Rooms;

/// <summary>
/// Admin management of meetings, through the real pipeline and a real database.
/// </summary>
/// <remarks>
/// <para>
/// This is step 4's success criterion — <b>a meeting can be created and its link copied</b>. The link
/// half needs a real database because the type/join-mode rules are CHECK constraints, and a validator
/// that drifts from them turns a clear message into an unexplained 500.
/// </para>
/// <para>
/// The media server is <see cref="FakeLiveKitAdmin"/>; see its remarks for why no test may reach the
/// real one.
/// </para>
/// </remarks>
public class RoomAdminTests : TestBase
{
    private const string Presenter = "5555555555";
    private const string Invitee = "1234567890";
    private const string SecondInvitee = "9876543210";

    private static EngineerInfo Engineer(string nationalCode, string firstName = "آزمون") => new(
        NationalCode: nationalCode,
        FirstName: firstName,
        LastName: "مهندس",
        ReshteCode: "4",
        Mobile: "09120000000",
        MembershipStatus: 0,
        LicenceExpiryJalali: "1499/12/29",
        EducationLevel: "کارشناسی");

    private static RoomInput Meeting(
        RoomJoinMode joinMode = RoomJoinMode.InviteOnly,
        string name = "جلسهٔ کمیسیون گاز") => new(
        Name: name,
        Description: null,
        Type: RoomType.Meeting,
        JoinMode: joinMode,
        PresenterUserId: null,
        DateJalali: "1405/05/10",
        StartTime: new TimeOnly(10, 0),
        EarlyJoinMinutes: 10,
        DurationMinutes: 60,
        MaxParticipants: 50);

    private static RoomInput Presentation(
        RoomJoinMode joinMode = RoomJoinMode.Public,
        string? presenterUserId = Presenter) => new(
        Name: "وبینار ایمنی گاز",
        Description: "برای همهٔ اعضا",
        Type: RoomType.Presentation,
        JoinMode: joinMode,
        PresenterUserId: presenterUserId,
        DateJalali: "1405/05/10",
        StartTime: new TimeOnly(18, 30),
        EarlyJoinMinutes: 15,
        DurationMinutes: 90,
        MaxParticipants: 200);

    /// <summary>
    /// Seeds the presenter in the membership directory.
    /// </summary>
    /// <remarks>
    /// Runs after <see cref="TestBase.SetUp"/> resets the directory — NUnit runs base set-up first —
    /// so every presentation in this file has a presenter the organisation actually knows. Creating one
    /// without that is its own test, below.
    /// </remarks>
    [SetUp]
    public void SeedPresenter()
        => FunctionalTestSetup.Directory.Add(Engineer(Presenter, "ارائه‌دهنده"));

    // ── the criterion ────────────────────────────────────────────────────────

    [Test]
    public async Task A_meeting_can_be_created_and_its_link_copied()
    {
        await TestApp.RunAsAdministratorAsync();

        var id = await TestApp.SendAsync(new CreateRoomCommand(Presentation()));

        var room = await TestApp.SendAsync(new GetRoomQuery(id));

        // The whole URL, not a token the caller has to assemble: the base address is decided in one
        // place, so a link is the same however it was made.
        room.JoinUrl.ShouldNotBeNull();
        room.JoinUrl.ShouldStartWith("https://room.test/j/");
        room.JoinUrl.Length.ShouldBe("https://room.test/j/".Length + 32);

        // The slug is what a media token is scoped to. Its prefix is the only thing keeping a room name
        // from colliding with another product's on a shared server.
        room.Slug.ShouldStartWith("ceo-");
    }

    [Test]
    public async Task The_link_appears_on_the_meeting_row_right_after_create()
    {
        await TestApp.RunAsAdministratorAsync();

        await TestApp.SendAsync(new CreateRoomCommand(Presentation()));

        // Amir asked for the link on the row, not one click deeper. If the list DTO ever drops it, the
        // admin panel silently loses the only way to hand a meeting out.
        var rows = await TestApp.SendAsync(new GetRoomsQuery());

        rows.Count.ShouldBe(1);
        rows[0].JoinUrl.ShouldNotBeNullOrWhiteSpace();
    }

    [Test]
    public async Task An_invite_only_meeting_has_no_link_at_all()
    {
        await TestApp.RunAsAdministratorAsync();

        var id = await TestApp.SendAsync(new CreateRoomCommand(Meeting()));

        var room = await TestApp.SendAsync(new GetRoomQuery(id));

        // Not an empty string: a link that exists but leads nowhere is worse than no link, because the
        // admin panel would still offer a copy button.
        room.JoinUrl.ShouldBeNull();

        var stored = await TestApp.FindAsync<Room>(id);
        stored!.JoinToken.ShouldBeNull();
    }

    // ── the presenter ────────────────────────────────────────────────────────

    [Test]
    public async Task The_presenter_name_comes_from_the_organisation_record_not_from_the_admin()
    {
        await TestApp.RunAsAdministratorAsync();

        var id = await TestApp.SendAsync(new CreateRoomCommand(Presentation()));

        var room = await TestApp.SendAsync(new GetRoomQuery(id));

        room.PresenterUserId.ShouldBe(Presenter);
        room.PresenterName.ShouldBe("ارائه‌دهنده مهندس");
    }

    [Test]
    public async Task A_presenter_who_is_not_in_the_directory_is_refused_at_create_time()
    {
        await TestApp.RunAsAdministratorAsync();

        var error = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(
                new CreateRoomCommand(Presentation(presenterUserId: "1111111111"))));

        error.Errors[nameof(RoomInput.PresenterUserId)]
            .ShouldContain(x => x.Contains("یافت نشد"));

        (await TestApp.CountAsync<Room>()).ShouldBe(0);
    }

    [Test]
    public async Task A_presenter_id_that_is_not_a_national_code_is_refused()
    {
        await TestApp.RunAsAdministratorAsync();

        // The whole point of the check. An authenticated join carries the کد ملی as its media identity
        // and MayPublish compares the two exactly, so a free-text id here would be a presenter who
        // joins their own presentation muted — with no error anywhere to explain it.
        var error = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(
                new CreateRoomCommand(Presentation(presenterUserId: "presenter-user-id"))));

        error.Errors[nameof(RoomInput.PresenterUserId)].ShouldNotBeEmpty();
    }

    [Test]
    public async Task A_presenter_typed_in_Persian_digits_is_stored_as_the_identity_a_join_will_carry()
    {
        await TestApp.RunAsAdministratorAsync();

        var id = await TestApp.SendAsync(
            new CreateRoomCommand(Presentation(presenterUserId: "۵۵۵۵۵۵۵۵۵۵")));

        // Stored ASCII, because that is what the login and the media token will use. Storing the
        // Persian form would compare unequal and silently mute the presenter.
        (await TestApp.FindAsync<Room>(id))!.PresenterUserId.ShouldBe(Presenter);
    }

    // ── looking a person up, for the admin panel's pickers ───────────────────

    [Test]
    public async Task A_national_code_resolves_to_the_name_on_file()
    {
        await TestApp.RunAsAdministratorAsync();

        var person = await TestApp.SendAsync(new LookupRoomPersonQuery(Presenter));

        person.NationalCode.ShouldBe(Presenter);
        person.FullName.ShouldBe("ارائه‌دهنده مهندس");
    }

    [Test]
    public async Task Persian_digits_resolve_to_the_same_person()
    {
        await TestApp.RunAsAdministratorAsync();

        // What an Iranian keyboard produces. The picker normalises before sending, but so does the
        // server — a lookup that answered "not found" for «۵۵۵…» would look like a missing member.
        var person = await TestApp.SendAsync(new LookupRoomPersonQuery("۵۵۵۵۵۵۵۵۵۵"));

        person.NationalCode.ShouldBe(Presenter);
    }

    [Test]
    public async Task The_lookup_tells_an_outage_apart_from_an_unknown_person()
    {
        await TestApp.RunAsAdministratorAsync();

        var unknown = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new LookupRoomPersonQuery("1111111111")));
        unknown.Errors[nameof(LookupRoomPersonQuery.NationalCode)]
            .ShouldContain(x => x.Contains("یافت نشد"));

        FunctionalTestSetup.Directory.IsUnavailable = true;

        var outage = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new LookupRoomPersonQuery(Presenter)));

        // Same helper as the invite and presenter paths, so the three can never disagree about the
        // same person — including on this distinction, which the election work recorded in GOTCHAS.
        outage.Errors[nameof(LookupRoomPersonQuery.NationalCode)]
            .ShouldContain(x => x.Contains("ارتباط"));
    }

    [Test]
    public async Task A_non_administrator_cannot_turn_a_national_code_into_a_name()
    {
        TestApp.RunAsEngineerAsync(Invitee, Roles.User);

        // One direction, admins only. A route that went the other way — name to code — would be a
        // downloadable membership list.
        await Should.ThrowAsync<Common.Exceptions.ForbiddenAccessException>(
            () => TestApp.SendAsync(new LookupRoomPersonQuery(Presenter)));
    }

    // ── the shape rules, against the real constraints ────────────────────────

    [Test]
    public async Task A_public_meeting_is_refused_because_only_a_presentation_may_be_public()
    {
        await TestApp.RunAsAdministratorAsync();

        var error = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new CreateRoomCommand(Meeting(RoomJoinMode.Public))));

        // A Persian sentence, not a constraint name. The database would have refused this too — that is
        // the point — but an admin must never see CK_Rooms_PublicIsPresentationOnly.
        error.Errors[nameof(RoomInput.JoinMode)]
            .ShouldContain(x => x.Contains("لینک عمومی"));

        (await TestApp.CountAsync<Room>()).ShouldBe(0);
    }

    [Test]
    public async Task A_presentation_without_a_presenter_is_refused()
    {
        await TestApp.RunAsAdministratorAsync();

        var error = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(
                new CreateRoomCommand(Presentation(presenterUserId: null))));

        error.Errors[nameof(RoomInput.JoinMode)]
            .ShouldContain(x => x.Contains("ارائه‌دهنده"));

        (await TestApp.CountAsync<Room>()).ShouldBe(0);
    }

    [Test]
    public async Task An_invite_only_presentation_is_refused()
    {
        await TestApp.RunAsAdministratorAsync();

        var error = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(
                new CreateRoomCommand(Presentation(RoomJoinMode.InviteOnly))));

        error.Errors[nameof(RoomInput.JoinMode)].ShouldNotBeEmpty();
        (await TestApp.CountAsync<Room>()).ShouldBe(0);
    }

    [Test]
    public async Task A_bad_Jalali_date_is_refused_before_it_reaches_the_database()
    {
        await TestApp.RunAsAdministratorAsync();

        var error = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(
                new CreateRoomCommand(Meeting() with { DateJalali = "1405/13/40" })));

        error.Errors[nameof(RoomInput.DateJalali)].ShouldNotBeEmpty();
    }

    // ── update ───────────────────────────────────────────────────────────────

    [Test]
    public async Task Switching_a_presentation_to_a_meeting_clears_the_presenter()
    {
        await TestApp.RunAsAdministratorAsync();
        var id = await TestApp.SendAsync(new CreateRoomCommand(Presentation()));

        await TestApp.SendAsync(new UpdateRoomCommand(id, Meeting(RoomJoinMode.Private)));

        var stored = await TestApp.FindAsync<Room>(id);

        // A stale presenter name on a meeting would show on the join page as though somebody still had
        // the floor, when in a meeting everybody does.
        stored!.PresenterUserId.ShouldBeNull();
        stored.PresenterName.ShouldBeNull();
    }

    [Test]
    public async Task Switching_a_link_meeting_to_invite_only_drops_the_link()
    {
        await TestApp.RunAsAdministratorAsync();
        var id = await TestApp.SendAsync(new CreateRoomCommand(Meeting(RoomJoinMode.Private)));

        (await TestApp.FindAsync<Room>(id))!.JoinToken.ShouldNotBeNull();

        await TestApp.SendAsync(new UpdateRoomCommand(id, Meeting()));

        // Every copy of the old link stops working the moment the door closes.
        (await TestApp.FindAsync<Room>(id))!.JoinToken.ShouldBeNull();
    }

    [Test]
    public async Task Switching_away_from_invite_only_removes_an_invite_list_that_no_longer_gates_anything()
    {
        await TestApp.RunAsAdministratorAsync();
        FunctionalTestSetup.Directory.Add(Engineer(Invitee));

        var id = await TestApp.SendAsync(new CreateRoomCommand(Meeting()));
        await TestApp.SendAsync(new InviteToRoomCommand(id, Invitee));
        (await TestApp.CountAsync<RoomInvite>()).ShouldBe(1);

        await TestApp.SendAsync(new UpdateRoomCommand(id, Meeting(RoomJoinMode.Private)));

        // A list left behind reads as though it still decides who gets in.
        (await TestApp.CountAsync<RoomInvite>()).ShouldBe(0);
    }

    [Test]
    public async Task The_start_time_is_stored_as_one_absolute_instant()
    {
        await TestApp.RunAsAdministratorAsync();

        var id = await TestApp.SendAsync(new CreateRoomCommand(Meeting()));

        var stored = await TestApp.FindAsync<Room>(id);

        // 1405/05/10 10:00 Iran time. Resolved once on save, so no later comparison depends on the
        // server's own time zone — the whole reason the entity keeps an instant and not a date.
        stored!.StartsAtUtc.ShouldBe(new DateTimeOffset(2026, 8, 1, 10, 0, 0, TimeSpan.FromHours(3.5)));

        // The door opens ten minutes early, and that is derived, not stored twice.
        stored.OpensAtUtc.ShouldBe(stored.StartsAtUtc.AddMinutes(-10));
    }

    // ── regenerating a link ──────────────────────────────────────────────────

    [Test]
    public async Task Regenerating_the_link_kills_the_old_one()
    {
        await TestApp.RunAsAdministratorAsync();
        var id = await TestApp.SendAsync(new CreateRoomCommand(Presentation()));
        var before = (await TestApp.FindAsync<Room>(id))!.JoinToken;

        var after = await TestApp.SendAsync(new RegenerateRoomLinkCommand(id));

        after.ShouldNotBe(before);
        after.Length.ShouldBe(32);
        (await TestApp.FindAsync<Room>(id))!.JoinToken.ShouldBe(after);
    }

    [Test]
    public async Task Regenerating_a_link_on_an_invite_only_meeting_is_refused_rather_than_silently_creating_one()
    {
        await TestApp.RunAsAdministratorAsync();
        var id = await TestApp.SendAsync(new CreateRoomCommand(Meeting()));

        await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new RegenerateRoomLinkCommand(id)));

        // Handing out a link for a meeting that is supposed to be invite-only would widen the door
        // without anyone choosing to.
        (await TestApp.FindAsync<Room>(id))!.JoinToken.ShouldBeNull();
    }

    // ── invites ──────────────────────────────────────────────────────────────

    [Test]
    public async Task An_invite_stores_the_real_name_from_the_membership_directory()
    {
        await TestApp.RunAsAdministratorAsync();
        FunctionalTestSetup.Directory.Add(Engineer(Invitee));
        var id = await TestApp.SendAsync(new CreateRoomCommand(Meeting()));

        await TestApp.SendAsync(new InviteToRoomCommand(id, Invitee));

        var room = await TestApp.SendAsync(new GetRoomQuery(id));
        var invite = room.Invites.ShouldHaveSingleItem();

        invite.UserId.ShouldBe(Invitee);

        // Not whatever an admin typed. A mistyped name on the door is a person who cannot prove they
        // are the person who was invited.
        invite.UserName.ShouldBe("آزمون مهندس");
    }

    [Test]
    public async Task Inviting_a_code_that_belongs_to_nobody_fails_now_rather_than_at_the_door()
    {
        await TestApp.RunAsAdministratorAsync();
        var id = await TestApp.SendAsync(new CreateRoomCommand(Meeting()));

        var error = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new InviteToRoomCommand(id, "1111111111")));

        error.Errors[nameof(InviteToRoomCommand.NationalCode)]
            .ShouldContain(x => x.Contains("یافت نشد"));

        (await TestApp.CountAsync<RoomInvite>()).ShouldBe(0);
    }

    [Test]
    public async Task A_directory_outage_does_not_read_as_this_person_does_not_exist()
    {
        await TestApp.RunAsAdministratorAsync();
        FunctionalTestSetup.Directory.Add(Engineer(Invitee));
        FunctionalTestSetup.Directory.IsUnavailable = true;
        var id = await TestApp.SendAsync(new CreateRoomCommand(Meeting()));

        var error = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new InviteToRoomCommand(id, Invitee)));

        // The same trap the election work recorded: "not found" and "could not ask" must never share a
        // message, or an outage quietly becomes a claim about somebody's membership.
        error.Errors[nameof(InviteToRoomCommand.NationalCode)]
            .ShouldContain(x => x.Contains("ارتباط"));
    }

    [Test]
    public async Task Inviting_the_same_person_twice_is_not_an_error_and_adds_one_row()
    {
        await TestApp.RunAsAdministratorAsync();
        FunctionalTestSetup.Directory.Add(Engineer(Invitee));
        var id = await TestApp.SendAsync(new CreateRoomCommand(Meeting()));

        await TestApp.SendAsync(new InviteToRoomCommand(id, Invitee));
        await TestApp.SendAsync(new InviteToRoomCommand(id, Invitee));

        (await TestApp.CountAsync<RoomInvite>()).ShouldBe(1);
    }

    [Test]
    public async Task An_invite_on_a_link_meeting_is_refused_so_two_gates_cannot_disagree()
    {
        await TestApp.RunAsAdministratorAsync();
        FunctionalTestSetup.Directory.Add(Engineer(Invitee));
        var id = await TestApp.SendAsync(new CreateRoomCommand(Presentation()));

        await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new InviteToRoomCommand(id, Invitee)));
    }

    [Test]
    public async Task Removing_an_invite_leaves_the_others_alone()
    {
        await TestApp.RunAsAdministratorAsync();
        FunctionalTestSetup.Directory.Add(Engineer(Invitee));
        FunctionalTestSetup.Directory.Add(Engineer(SecondInvitee));
        var id = await TestApp.SendAsync(new CreateRoomCommand(Meeting()));
        await TestApp.SendAsync(new InviteToRoomCommand(id, Invitee));
        await TestApp.SendAsync(new InviteToRoomCommand(id, SecondInvitee));

        await TestApp.SendAsync(new RemoveRoomInviteCommand(id, Invitee));

        var room = await TestApp.SendAsync(new GetRoomQuery(id));
        room.Invites.ShouldHaveSingleItem().UserId.ShouldBe(SecondInvitee);
    }

    // ── closing a meeting ────────────────────────────────────────────────────

    [Test]
    public async Task Deactivating_a_meeting_also_empties_it()
    {
        await TestApp.RunAsAdministratorAsync();
        var id = await TestApp.SendAsync(new CreateRoomCommand(Presentation()));
        var slug = (await TestApp.FindAsync<Room>(id))!.Slug;

        await TestApp.SendAsync(new SetRoomActiveCommand(id, false));

        // Leaving a live meeting running after an admin switched it off looks exactly like the switch
        // not working — and everyone inside stays inside.
        FunctionalTestSetup.LiveKit.EndedRooms.ShouldContain(slug);
        (await TestApp.FindAsync<Room>(id))!.IsActive.ShouldBeFalse();
    }

    [Test]
    public async Task Deleting_a_meeting_hides_it_kills_the_link_and_ends_the_call()
    {
        await TestApp.RunAsAdministratorAsync();
        var id = await TestApp.SendAsync(new CreateRoomCommand(Presentation()));
        var slug = (await TestApp.FindAsync<Room>(id))!.Slug;

        await TestApp.SendAsync(new DeleteRoomCommand(id));

        var stored = await TestApp.FindAsync<Room>(id);

        // Soft delete: the chat history stays readable and the slug is never reused, so an old link can
        // never land in a new meeting.
        stored!.IsDeleted.ShouldBeTrue();
        stored.JoinToken.ShouldBeNull();
        FunctionalTestSetup.LiveKit.EndedRooms.ShouldContain(slug);

        (await TestApp.SendAsync(new GetRoomsQuery())).ShouldBeEmpty();
    }

    // ── the list ─────────────────────────────────────────────────────────────

    [Test]
    public async Task The_list_shows_the_live_head_count_per_row()
    {
        await TestApp.RunAsAdministratorAsync();
        var id = await TestApp.SendAsync(new CreateRoomCommand(Presentation()));
        var slug = (await TestApp.FindAsync<Room>(id))!.Slug;
        FunctionalTestSetup.LiveKit.SetLiveCount(slug, 7);

        var rows = await TestApp.SendAsync(new GetRoomsQuery());

        rows.ShouldHaveSingleItem().LiveCount.ShouldBe(7);
    }

    [Test]
    public async Task The_list_still_renders_when_the_media_server_is_unreachable()
    {
        await TestApp.RunAsAdministratorAsync();
        await TestApp.SendAsync(new CreateRoomCommand(Presentation()));

        // No head-count was ever arranged, which is what an unreachable server produces: zeros, not an
        // exception. A meeting list must not become a 500 because another machine hiccuped.
        var rows = await TestApp.SendAsync(new GetRoomsQuery());

        rows.ShouldHaveSingleItem().LiveCount.ShouldBe(0);
    }

    [Test]
    public async Task A_non_administrator_cannot_see_a_join_link()
    {
        TestApp.RunAsEngineerAsync(Invitee);

        // The link is the entire gate for a public presentation. If a signed-in engineer could list
        // meetings, they would be holding the door key for every one of them.
        await Should.ThrowAsync<Common.Exceptions.ForbiddenAccessException>(
            () => TestApp.SendAsync(new GetRoomsQuery()));
    }

    [Test]
    public async Task A_non_administrator_cannot_create_a_meeting()
    {
        TestApp.RunAsEngineerAsync(Invitee, Roles.User);

        await Should.ThrowAsync<Common.Exceptions.ForbiddenAccessException>(
            () => TestApp.SendAsync(new CreateRoomCommand(Meeting())));
    }
}
