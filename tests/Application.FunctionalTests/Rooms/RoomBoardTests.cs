using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.FunctionalTests.Infrastructure;
using Mabhas19.Application.Rooms;
using Mabhas19.Domain.Rooms;
using Microsoft.EntityFrameworkCore;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.FunctionalTests.Rooms;

/// <summary>
/// The saved whiteboard, and who may write to it.
/// </summary>
/// <remarks>
/// The board is delivered live over the media server's data channel; this is the copy a reload and a
/// late joiner read. Which makes the write gate the interesting half: in a presentation only the
/// presenter may draw, and that must be decided here rather than by the browser, because every
/// participant's token lets them put bytes on the data channel.
/// </remarks>
public class RoomBoardTests : TestBase
{
    private const string Presenter = "5555555555";
    private const string Member = "1234567890";

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
    }

    private const string Scene = """{"type":"excalidraw","elements":[{"id":"a","version":1}]}""";

    private static async Task<Room> SeedAsync(
        RoomType type = RoomType.Presentation,
        RoomJoinMode joinMode = RoomJoinMode.Public,
        bool isActive = true)
    {
        var room = new Room
        {
            Name = "کارگاه طراحی",
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

    private static async Task<RoomJoinDto> JoinAsGuestAsync(Room room, string name = "رضا احمدی")
    {
        TestApp.SignOut();
        return await TestApp.SendAsync(new JoinRoomByLinkCommand(room.JoinToken!, name));
    }

    [Test]
    public async Task The_presenter_saves_a_board_and_reads_it_back()
    {
        var room = await SeedAsync();
        TestApp.RunAsEngineerAsync(Presenter);

        await TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, null, Scene));

        var saved = await TestApp.SendAsync(new GetRoomBoardQuery(room.Id, null));

        saved.ShouldNotBeNull();
        saved!.Scene.ShouldBe(Scene);
    }

    [Test]
    public async Task An_empty_room_has_no_board_rather_than_an_error()
    {
        var room = await SeedAsync();
        TestApp.RunAsEngineerAsync(Presenter);

        (await TestApp.SendAsync(new GetRoomBoardQuery(room.Id, null))).ShouldBeNull();
    }

    [Test]
    public async Task Saving_twice_replaces_the_board_rather_than_adding_a_second()
    {
        var room = await SeedAsync();
        TestApp.RunAsEngineerAsync(Presenter);

        await TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, null, Scene));
        await TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, null, """{"elements":[]}"""));

        (await TestApp.CountAsync<RoomBoard>()).ShouldBe(1);
        (await TestApp.SendAsync(new GetRoomBoardQuery(room.Id, null)))!.Scene.ShouldBe("""{"elements":[]}""");
    }

    [Test]
    public async Task An_audience_guest_can_READ_the_board_but_not_write_to_it()
    {
        var room = await SeedAsync();
        TestApp.RunAsEngineerAsync(Presenter);
        await TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, null, Scene));

        var join = await JoinAsGuestAsync(room);

        // Watching the presenter draw is the point, so reading is allowed.
        (await TestApp.SendAsync(new GetRoomBoardQuery(room.Id, join.Token)))!.Scene.ShouldBe(Scene);

        // Drawing is not. Their token lets them put bytes on the data channel — nothing stops that —
        // so this is where a forged edit is actually refused.
        await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, join.Token, """{"elements":[]}""")));

        (await TestApp.SendAsync(new GetRoomBoardQuery(room.Id, join.Token)))!.Scene.ShouldBe(Scene);
    }

    [Test]
    public async Task In_a_MEETING_any_invited_member_may_write()
    {
        var room = await SeedAsync(RoomType.Meeting, RoomJoinMode.InviteOnly);
        await TestApp.AddAsync(new RoomInvite { RoomId = room.Id, UserId = Member, UserName = "عضو مهندس" });

        TestApp.RunAsEngineerAsync(Member);
        await TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, null, Scene));

        (await TestApp.SendAsync(new GetRoomBoardQuery(room.Id, null)))!.Scene.ShouldBe(Scene);
    }

    [Test]
    public async Task A_token_for_another_meeting_cannot_read_or_write_this_board()
    {
        var mine = await SeedAsync();
        var theirs = await SeedAsync();
        var join = await JoinAsGuestAsync(theirs);

        await Should.ThrowAsync<Ardalis.GuardClauses.NotFoundException>(
            () => TestApp.SendAsync(new GetRoomBoardQuery(mine.Id, join.Token)));

        await Should.ThrowAsync<Ardalis.GuardClauses.NotFoundException>(
            () => TestApp.SendAsync(new SaveRoomBoardCommand(mine.Id, join.Token, Scene)));
    }

    [Test]
    public async Task A_closed_meeting_keeps_its_board_readable_and_takes_no_more_saves()
    {
        var room = await SeedAsync();
        TestApp.RunAsEngineerAsync(Presenter);
        await TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, null, Scene));

        await TestApp.MutateAsync<Room>(r => r.IsActive = false, room.Id);

        var error = await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, null, """{"elements":[]}""")));
        error.Errors["Scene"].ShouldContain(x => x.Contains("بسته"));

        (await TestApp.SendAsync(new GetRoomBoardQuery(room.Id, null)))!.Scene.ShouldBe(Scene);
    }

    [Test]
    public async Task The_database_refuses_a_second_board_for_the_same_meeting()
    {
        var room = await SeedAsync();
        await TestApp.AddAsync(new RoomBoard { RoomId = room.Id, Scene = Scene, UpdatedBy = Presenter });

        // This is the guard the save handler's retry depends on. Without a unique index, two people
        // drawing on a fresh board at the same moment would leave the meeting with two rows and no
        // rule about which one is the board. In-memory providers ignore CHECK constraints and unique
        // indexes, which is why this test earns its keep only against real SQL Server.
        await Should.ThrowAsync<DbUpdateException>(
            () => TestApp.AddAsync(new RoomBoard { RoomId = room.Id, Scene = "{}", UpdatedBy = Member }));

        (await TestApp.CountAsync<RoomBoard>()).ShouldBe(1);
    }

    [Test]
    public async Task A_scene_over_the_size_cap_is_refused_rather_than_truncated()
    {
        var room = await SeedAsync();
        TestApp.RunAsEngineerAsync(Presenter);

        // A truncated scene is corrupt, where a truncated chat line is merely short.
        var huge = new string('x', RoomBoardRules.MaxSceneLength + 1);

        await Should.ThrowAsync<ValidationException>(
            () => TestApp.SendAsync(new SaveRoomBoardCommand(room.Id, null, huge)));

        (await TestApp.CountAsync<RoomBoard>()).ShouldBe(0);
    }
}
