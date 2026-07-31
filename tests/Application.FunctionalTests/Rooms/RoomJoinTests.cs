using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.FunctionalTests.Infrastructure;
using Mabhas19.Application.Rooms;
using Mabhas19.Domain.Rooms;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.FunctionalTests.Rooms;

/// <summary>
/// Getting into a meeting, end to end: a real database, a real identity, a real signed token.
/// </summary>
/// <remarks>
/// <para>
/// The gates themselves are proven exhaustively in <c>RoomJoinRuleTests</c>, which needs no stack. What
/// this file proves is the <b>wiring</b> — that the identity the API sees is the one the rules compare,
/// that the invite list is really consulted, and above all that the token which comes back says what
/// the response claims it says.
/// </para>
/// <para>
/// That last one is why these tests decode the JWT rather than trusting <c>CanPublish</c>. The media
/// server obeys the token, not the DTO; if they ever disagreed, the response would look right and the
/// audience would have microphones.
/// </para>
/// </remarks>
public class RoomJoinTests : TestBase
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

    /// <summary>
    /// Seeds a meeting directly, with a window that is already open.
    /// </summary>
    /// <remarks>
    /// The window is set from absolute instants around <c>UtcNow</c> rather than a Jalali date, so these
    /// tests never become time-of-day dependent. Going through <c>CreateRoomCommand</c> would tie every
    /// join test to a fixed date that goes stale.
    /// </remarks>
    private static async Task<Room> SeedAsync(
        RoomType type = RoomType.Presentation,
        RoomJoinMode joinMode = RoomJoinMode.Public,
        int startsInMinutes = -5,
        int maxParticipants = 50,
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
            StartsAtUtc = DateTimeOffset.UtcNow.AddMinutes(startsInMinutes),
            EarlyJoinMinutes = 0,
            MaxParticipants = maxParticipants,
            IsActive = isActive
        };

        await TestApp.AddAsync(room);
        return room;
    }

    /// <summary>
    /// The claims inside the minted media token.
    /// </summary>
    /// <remarks>
    /// Hand-decoded rather than parsed by a library, because the point is to read exactly what was
    /// signed. The signature itself is verified in <c>RoomTokenServiceTests</c>.
    /// </remarks>
    private static JsonElement Claims(string token)
    {
        var payload = token.Split('.')[1].Replace('-', '+').Replace('_', '/');
        payload = payload.PadRight(payload.Length + ((4 - (payload.Length % 4)) % 4), '=');

        return JsonDocument.Parse(Encoding.UTF8.GetString(Convert.FromBase64String(payload)))
            .RootElement;
    }

    private static JsonElement Video(string token) => Claims(token).GetProperty("video");

    // ── the criterion, both paths ────────────────────────────────────────────

    [Test]
    public async Task A_stranger_with_a_public_link_gets_in_and_cannot_publish()
    {
        var room = await SeedAsync();

        var join = await TestApp.SendAsync(
            new JoinRoomByLinkCommand(room.JoinToken!, "رضا احمدی"));

        join.DisplayName.ShouldBe("رضا احمدی");
        join.Identity.ShouldStartWith("guest-");
        join.WsUrl.ShouldBe("wss://lk.test");
        join.RoomName.ShouldBe(room.Name);
        join.PresenterName.ShouldBe("ارائه‌دهنده مهندس");

        // The DTO says so…
        join.CanPublish.ShouldBeFalse();

        // …and so does the token, which is the half that is actually enforced. LiveKit reads an
        // OMITTED canPublish as true, so the flag has to be present and false in the signed bytes.
        var video = Video(join.Token);
        video.GetProperty("canPublish").GetBoolean().ShouldBeFalse();
        video.GetProperty("room").GetString().ShouldBe(room.Slug);
        video.GetProperty("canPublishData").GetBoolean().ShouldBeTrue();
    }

    [Test]
    public async Task An_invited_member_gets_in_by_id_and_may_publish_in_a_meeting()
    {
        var room = await SeedAsync(RoomType.Meeting, RoomJoinMode.InviteOnly);
        await TestApp.AddAsync(new RoomInvite { RoomId = room.Id, UserId = Member, UserName = "عضو مهندس" });

        TestApp.RunAsEngineerAsync(Member);

        var join = await TestApp.SendAsync(new JoinRoomCommand(room.Id));

        // The identity is the کد ملی, not a guest id — that is what makes chat authorship and any
        // later audit able to tell a member from a link visitor.
        join.Identity.ShouldBe(Member);
        join.CanPublish.ShouldBeTrue();
        Video(join.Token).GetProperty("canPublish").GetBoolean().ShouldBeTrue();
    }

    [Test]
    public async Task The_presenter_may_publish_and_everybody_else_in_the_same_room_may_not()
    {
        var room = await SeedAsync();

        TestApp.RunAsEngineerAsync(Presenter);
        var presenter = await TestApp.SendAsync(new JoinRoomByLinkCommand(room.JoinToken!, null));

        // Signed out, not reset — the room has to survive into the second half of this test.
        TestApp.SignOut();
        var guest = await TestApp.SendAsync(new JoinRoomByLinkCommand(room.JoinToken!, "رضا"));

        // Same room, same link, two different tokens. This one difference is the entire feature.
        Video(presenter.Token).GetProperty("canPublish").GetBoolean().ShouldBeTrue();
        Video(guest.Token).GetProperty("canPublish").GetBoolean().ShouldBeFalse();

        presenter.Identity.ShouldBe(Presenter);
        presenter.DisplayName.ShouldBe(Presenter);
    }

    [Test]
    public async Task An_administrator_joins_a_presentation_as_audience()
    {
        var room = await SeedAsync();
        await TestApp.RunAsAdministratorAsync();

        var join = await TestApp.SendAsync(new JoinRoomCommand(room.Id));

        // Administrators may enter any meeting, but «فقط ارائه‌دهنده صحبت می‌کند» means exactly that.
        // Ending the meeting or removing somebody goes through /api/RoomAdmin, where the caller is
        // checked — not through a token that could be tricked out of a browser.
        join.CanPublish.ShouldBeFalse();
        Video(join.Token).GetProperty("canPublish").GetBoolean().ShouldBeFalse();
        Video(join.Token).TryGetProperty("roomAdmin", out var admin).ShouldBeFalse();
        admin.ValueKind.ShouldBe(JsonValueKind.Undefined);
    }

    // ── the gates, through the real stack ────────────────────────────────────

    [Test]
    public async Task An_unknown_link_is_not_found()
        => await Should.ThrowAsync<Ardalis.GuardClauses.NotFoundException>(
            () => TestApp.SendAsync(new JoinRoomByLinkCommand(new string('f', 32), "رضا")));

    [Test]
    public async Task A_deleted_meeting_kills_its_link()
    {
        var room = await SeedAsync();
        var link = room.JoinToken!;

        await TestApp.RunAsAdministratorAsync();
        await TestApp.SendAsync(new DeleteRoomCommand(room.Id));

        // Signed out, NOT reset. ResetState empties the database, so the link would be dead because
        // the row vanished rather than because deleting the meeting revoked it — the test would pass
        // while proving nothing.
        TestApp.SignOut();
        (await TestApp.CountAsync<Room>()).ShouldBe(1);

        // Nobody ever revoked this link by hand. Deleting the meeting cleared the token, so the same
        // URL now matches no row — and answers exactly like a link that was never real.
        await Should.ThrowAsync<Ardalis.GuardClauses.NotFoundException>(
            () => TestApp.SendAsync(new JoinRoomByLinkCommand(link, "رضا")));
    }

    [Test]
    public async Task A_closed_meeting_says_it_is_closed()
    {
        var room = await SeedAsync(isActive: false);

        var error = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new JoinRoomByLinkCommand(room.JoinToken!, "رضا")));

        error.Errors["Join"].ShouldContain(x => x.Contains("بسته"));
    }

    [Test]
    public async Task A_private_link_answers_401_to_a_stranger_so_the_page_can_send_them_to_sign_in()
    {
        var room = await SeedAsync(joinMode: RoomJoinMode.Private);

        // A 401 and not a 400, because this is the one refusal the browser can fix by itself.
        await Should.ThrowAsync<UnauthorizedAccessException>(
            () => TestApp.SendAsync(new JoinRoomByLinkCommand(room.JoinToken!, "رضا")));
    }

    [Test]
    public async Task The_same_private_link_works_once_they_have_signed_in()
    {
        var room = await SeedAsync(joinMode: RoomJoinMode.Private);
        TestApp.RunAsEngineerAsync(Outsider);

        var join = await TestApp.SendAsync(new JoinRoomByLinkCommand(room.JoinToken!, null));

        // One endpoint before and after signing in, so the SPA has nothing to translate. Membership
        // itself was the gate — this person is on no invite list.
        join.Identity.ShouldBe(Outsider);
        join.CanPublish.ShouldBeFalse();
    }

    [Test]
    public async Task A_typed_name_is_ignored_for_somebody_who_is_signed_in()
    {
        var room = await SeedAsync(joinMode: RoomJoinMode.Private);
        TestApp.RunAsEngineerAsync(Outsider);

        var join = await TestApp.SendAsync(
            new JoinRoomByLinkCommand(room.JoinToken!, "مدیر سازمان"));

        // A member cannot rename themselves on the way in. Their name comes from their account, so
        // nobody signs in as themselves and appears as somebody else.
        join.DisplayName.ShouldBe(Outsider);
    }

    [Test]
    public async Task A_member_who_was_not_invited_is_told_that_and_not_something_vaguer()
    {
        var room = await SeedAsync(RoomType.Meeting, RoomJoinMode.InviteOnly);
        TestApp.RunAsEngineerAsync(Outsider);

        var error = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new JoinRoomCommand(room.Id)));

        error.Errors["Join"].ShouldContain(x => x.Contains("دعوت"));
    }

    [Test]
    public async Task Nobody_gets_in_before_the_countdown_ends()
    {
        var room = await SeedAsync(startsInMinutes: 30);

        var error = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new JoinRoomByLinkCommand(room.JoinToken!, "رضا")));

        error.Errors["Join"].ShouldContain(x => x.Contains("زمان"));
    }

    [Test]
    public async Task A_full_meeting_turns_the_next_person_away()
    {
        var room = await SeedAsync(maxParticipants: 3);
        FunctionalTestSetup.LiveKit.SetLiveCount(room.Slug, 3);

        var error = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new JoinRoomByLinkCommand(room.JoinToken!, "رضا")));

        error.Errors["Join"].ShouldContain(x => x.Contains("ظرفیت"));
    }

    [Test]
    public async Task A_public_link_with_no_name_asks_for_one()
    {
        var room = await SeedAsync();

        var error = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new JoinRoomByLinkCommand(room.JoinToken!, "   ")));

        error.Errors["Join"].ShouldContain(x => x.Contains("نام"));
    }

    [Test]
    public async Task Joining_creates_the_room_on_the_media_server_before_the_browser_arrives()
    {
        var room = await SeedAsync();

        await TestApp.SendAsync(new JoinRoomByLinkCommand(room.JoinToken!, "رضا"));

        // Idempotent and fail-soft, so this is not load-bearing — but without it the first participant
        // creates the room implicitly and the max-participant cap is never applied to it.
        (await FunctionalTestSetup.LiveKit.LiveCountAsync(room.Slug)).ShouldBe(0);
    }

    // ── the landing page ─────────────────────────────────────────────────────

    [Test]
    public async Task The_landing_page_works_before_the_meeting_opens_and_gives_the_countdown_its_target()
    {
        var room = await SeedAsync(startsInMinutes: 45);

        var landing = await TestApp.SendAsync(new GetRoomLandingQuery(room.JoinToken!));

        // "Too early" is a normal answer here, not an error. The page draws a countdown against
        // OpensAtUtc and enables its own button when it ends.
        landing.CanJoinNow.ShouldBeFalse();
        landing.DenyMessage.ShouldContain("زمان");
        landing.OpensAtUtc.ShouldBe(room.StartsAtUtc, TimeSpan.FromSeconds(1));

        // Against the server's clock, not the visitor's — a laptop with the wrong time would
        // otherwise count down to the wrong moment, or straight past it.
        landing.ServerNowUtc.ShouldBeLessThan(landing.OpensAtUtc);

        landing.Name.ShouldBe(room.Name);
        landing.PresenterName.ShouldBe("ارائه‌دهنده مهندس");
        landing.RequiresName.ShouldBeTrue();
        landing.RequiresSignIn.ShouldBeFalse();
    }

    [Test]
    public async Task The_landing_page_of_a_private_link_says_sign_in_rather_than_asking_for_a_name()
    {
        var room = await SeedAsync(joinMode: RoomJoinMode.Private);

        var landing = await TestApp.SendAsync(new GetRoomLandingQuery(room.JoinToken!));

        landing.RequiresSignIn.ShouldBeTrue();
        landing.RequiresName.ShouldBeFalse();
        landing.CanJoinNow.ShouldBeFalse();
    }

    [Test]
    public async Task The_landing_page_of_an_open_public_link_says_come_in()
    {
        var room = await SeedAsync();

        var landing = await TestApp.SendAsync(new GetRoomLandingQuery(room.JoinToken!));

        // A public link is waiting for a name, and that must not read as a refusal — the box has to be
        // fillable while the button is still greyed out.
        landing.CanJoinNow.ShouldBeTrue();
        landing.DenyMessage.ShouldBeEmpty();
        landing.RequiresName.ShouldBeTrue();
    }

    [Test]
    public async Task An_unknown_link_landing_is_not_found()
        => await Should.ThrowAsync<Ardalis.GuardClauses.NotFoundException>(
            () => TestApp.SendAsync(new GetRoomLandingQuery("nope")));

    // ── the HTTP pipeline, which MediatR tests cannot see ────────────────────

    [Test]
    public async Task The_link_routes_really_are_reachable_without_a_token()
    {
        var room = await SeedAsync();
        TestApp.SignOut();

        using var client = FunctionalTestSetup.CreateClient();

        // The group calls RequireAuthorization and these two routes call AllowAnonymous. Which wins is
        // decided by the authorisation middleware, not by any handler — so no MediatR test can prove
        // it, and getting it wrong makes a public presentation impossible to attend.
        var landing = await client.GetAsync($"/api/Room/j/{room.JoinToken}");
        landing.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK);

        var join = await client.PostAsJsonAsync(
            $"/api/Room/j/{room.JoinToken}", new { fullName = "رضا احمدی" });
        join.StatusCode.ShouldBe(System.Net.HttpStatusCode.OK);
    }

    [Test]
    public async Task The_member_routes_are_still_closed_without_a_token()
    {
        TestApp.SignOut();

        using var client = FunctionalTestSetup.CreateClient();

        // The other half of the same question. AllowAnonymous on two routes must not have opened the
        // group, or every attendee route would be public.
        var mine = await client.GetAsync("/api/Room/MyRooms");

        mine.StatusCode.ShouldBe(System.Net.HttpStatusCode.Unauthorized);
    }

    // ── what an attendee may see ─────────────────────────────────────────────

    [Test]
    public async Task My_meetings_shows_the_ones_I_was_invited_to_and_the_ones_I_present()
    {
        var invited = await SeedAsync(RoomType.Meeting, RoomJoinMode.InviteOnly);
        var presenting = await SeedAsync();
        await SeedAsync(RoomType.Meeting, RoomJoinMode.InviteOnly);

        await TestApp.AddAsync(
            new RoomInvite { RoomId = invited.Id, UserId = Member, UserName = "عضو مهندس" });

        TestApp.RunAsEngineerAsync(Member);
        var mine = await TestApp.SendAsync(new GetMyRoomsQuery());

        mine.Select(r => r.Id).ShouldBe([invited.Id], ignoreOrder: true);

        TestApp.RunAsEngineerAsync(Presenter);
        var theirs = await TestApp.SendAsync(new GetMyRoomsQuery());

        theirs.ShouldHaveSingleItem().Id.ShouldBe(presenting.Id);
        theirs[0].IsPresenter.ShouldBeTrue();
    }

    [Test]
    public async Task A_meeting_I_may_not_attend_is_a_404_rather_than_a_403()
    {
        var room = await SeedAsync(RoomType.Meeting, RoomJoinMode.InviteOnly);
        TestApp.RunAsEngineerAsync(Outsider);

        // A 403 would confirm the meeting exists. Walking the ids would then list everything the
        // organisation is holding, one request at a time.
        await Should.ThrowAsync<Ardalis.GuardClauses.NotFoundException>(
            () => TestApp.SendAsync(new GetRoomAttendeeQuery(room.Id)));
    }

    [Test]
    public async Task Nothing_an_attendee_can_reach_carries_the_join_link()
    {
        var room = await SeedAsync();
        TestApp.RunAsEngineerAsync(Presenter);

        var landing = await TestApp.SendAsync(new GetRoomLandingQuery(room.JoinToken!));
        var detail = await TestApp.SendAsync(new GetRoomAttendeeQuery(room.Id));
        var mine = await TestApp.SendAsync(new GetMyRoomsQuery());

        // The link is the entire gate for a public presentation. This asserts on the SERIALISED
        // payloads, because a field added later would slip past any property-by-property check.
        foreach (var payload in new object[] { landing, detail, mine })
        {
            var json = JsonSerializer.Serialize(payload);

            json.ShouldNotContain(room.JoinToken!);
            json.ShouldNotContain(room.Slug);
            json.ShouldNotContain(Presenter);
        }
    }
}
