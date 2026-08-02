using Mabhas19.Domain.Vms;
using Mabhas19.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Mabhas19.Application.FunctionalTests.Vms;

/// <summary>
/// The VMS camera model, against a real SQL Server.
/// </summary>
/// <remarks>
/// <para>
/// This is step 2's success criterion — <b>a camera exists in <c>CeoDb</c></b>. There is no API and
/// no UI yet, so the schema is the whole deliverable and these tests are the only thing that reads
/// it back.
/// </para>
/// <para>
/// It must be a functional test rather than a unit test: every rule below is a CHECK constraint, a
/// foreign key or a unique index, and an in-memory provider ignores all three. That is exactly how
/// <c>CK_Rooms_JoinTokenMatchesMode</c> reached production able to refuse a soft delete — see
/// GOTCHAS.
/// </para>
/// </remarks>
public class CameraSchemaTests : TestBase
{
    private const string City = "baneh";

    private static VmsCity SeedCity(string code = City, string name = "بانه") =>
        new() { Code = code, Name = name, DisplayOrder = 10 };

    /// <summary>The camera proven end to end in step 1, minus its password.</summary>
    private static Camera Camera1(string streamKey = "baneh-01", string cityCode = City) => new()
    {
        Name = "دوربین راه‌پله",
        CityCode = cityCode,
        Host = "78.39.233.70",
        RtspPort = 554,
        StreamKey = streamKey,
        CredentialKey = "default",
        Channel = 1,
        SubStreamId = 2,

        // Null on purpose, and it is the headline finding of step 1: this site uploads about
        // 0.41 Mbit/s and its 2560x1440 main stream needs ~11.2, so the main stream cannot be
        // watched at all. Only the 704x576 substream fits.
        MainStreamId = null
    };

    // ── the step 2 criterion ─────────────────────────────────────────────────

    [Test]
    public async Task A_camera_can_be_created_and_read_back()
    {
        await TestApp.AddAsync(SeedCity());

        var camera = Camera1();
        await TestApp.AddAsync(camera);

        var stored = await TestApp.FindAsync<Camera>(camera.Id);

        stored.ShouldNotBeNull();
        stored!.Name.ShouldBe("دوربین راه‌پله");
        stored.CityCode.ShouldBe(City);
        stored.StreamKey.ShouldBe("baneh-01");
        stored.IsViewable.ShouldBeTrue();
        stored.MainStreamId.ShouldBeNull();
    }

    [Test]
    public async Task The_stored_row_rebuilds_the_rtsp_path_step_1_discovered()
    {
        await TestApp.AddAsync(SeedCity());
        var camera = Camera1();
        await TestApp.AddAsync(camera);

        var stored = await TestApp.FindAsync<Camera>(camera.Id);

        // Byte for byte what answered 200 from the camera. The path could not be guessed — it came
        // out of the device's own js/Common.js — so the one place it is spelled has to be pinned.
        stored!.StreamPath(stored.SubStreamId).ShouldBe("/mode=real&idc=1&ids=2");
    }

    [Test]
    public async Task No_password_column_exists_on_the_camera_table()
    {
        // The design's promise is that CeoDb can describe every camera and open none of them. A
        // future "just add a Password field" would break it quietly, so assert the shape of the
        // table rather than trusting the entity to stay honest.
        using var scope = FunctionalTestSetup.ScopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var columns = context.Model
            .FindEntityType(typeof(Camera))!
            .GetProperties()
            .Select(p => p.Name)
            .ToList();

        columns.ShouldNotContain(n => n.Contains("password", StringComparison.OrdinalIgnoreCase));
        columns.ShouldNotContain(n => n.Contains("secret", StringComparison.OrdinalIgnoreCase));
        columns.ShouldContain(nameof(Camera.CredentialKey));
    }

    // ── the city is a table, not an enum ─────────────────────────────────────

    [Test]
    public async Task A_camera_in_an_unknown_city_is_refused_by_the_database()
    {
        await TestApp.AddAsync(SeedCity());

        // The election service stored a discipline code nothing validated and then met `Reshte = 8`,
        // a value with no name anywhere. A camera whose city does not exist would sit in the table
        // and never appear under any filter — invisible rather than broken.
        await Should.ThrowAsync<DbUpdateException>(
            TestApp.AddAsync(Camera1(cityCode: "nowhere")));
    }

    [Test]
    public async Task A_city_can_be_added_without_a_deployment()
    {
        await TestApp.AddAsync(SeedCity());

        // The whole reason this is a table: a ninth city is an INSERT, not a code change and a
        // release. Nothing here references a C# list of cities.
        await TestApp.AddAsync(new VmsCity { Code = "sanandaj", Name = "سنندج", DisplayOrder = 90 });
        await TestApp.AddAsync(Camera1(streamKey: "sanandaj-01", cityCode: "sanandaj"));

        (await TestApp.CountAsync<Camera>()).ShouldBe(1);
    }

    [Test]
    public async Task Deleting_a_city_that_still_holds_cameras_is_refused()
    {
        await TestApp.AddAsync(SeedCity());
        await TestApp.AddAsync(Camera1());

        using var scope = FunctionalTestSetup.ScopeFactory.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var city = await context.VmsCities.SingleAsync(c => c.Code == City);
        context.VmsCities.Remove(city);

        // Restrict, not Cascade. Removing a city from the picker must never take the cameras in it
        // with it — the admin has to move them first, deliberately.
        await Should.ThrowAsync<DbUpdateException>(context.SaveChangesAsync());
    }

    // ── constraints that only a real database enforces ───────────────────────

    [Test]
    public async Task Two_cameras_cannot_share_a_stream_key()
    {
        await TestApp.AddAsync(SeedCity());
        await TestApp.AddAsync(Camera1());

        // The stream key IS the name a browser asks go2rtc for. Two rows sharing it would put one
        // camera's picture on the other's tile, which reads as a wiring mistake at the site.
        await Should.ThrowAsync<DbUpdateException>(TestApp.AddAsync(Camera1()));
    }

    [Test]
    public async Task The_main_stream_may_not_be_the_same_stream_as_the_substream()
    {
        await TestApp.AddAsync(SeedCity());

        var camera = Camera1();
        camera.MainStreamId = camera.SubStreamId;

        // Otherwise "fullscreen switches to the main stream" opens a second session against a link
        // with room for exactly one, and the symptom is the camera appearing to drop out.
        await Should.ThrowAsync<DbUpdateException>(TestApp.AddAsync(camera));
    }

    [Test]
    public async Task A_channel_or_stream_index_below_one_is_refused()
    {
        await TestApp.AddAsync(SeedCity());

        var zeroChannel = Camera1(streamKey: "bad-channel");
        zeroChannel.Channel = 0;
        await Should.ThrowAsync<DbUpdateException>(TestApp.AddAsync(zeroChannel));

        var zeroStream = Camera1(streamKey: "bad-stream");
        zeroStream.SubStreamId = 0;
        await Should.ThrowAsync<DbUpdateException>(TestApp.AddAsync(zeroStream));
    }

    [Test]
    public async Task An_impossible_rtsp_port_is_refused()
    {
        await TestApp.AddAsync(SeedCity());

        var camera = Camera1();
        camera.RtspPort = 70000;

        await Should.ThrowAsync<DbUpdateException>(TestApp.AddAsync(camera));
    }

    // ── seeding ──────────────────────────────────────────────────────────────

    [Test]
    public async Task Seeding_creates_the_eight_cities_and_never_resurrects_a_removed_one()
    {
        await SeedAsync();

        var cities = await TestApp.AllAsync<VmsCity>();
        cities.Count.ShouldBe(8);
        cities.Select(c => c.Code).ShouldContain("baneh");
        cities.Select(c => c.Name).ShouldContain("دیواندره");

        // An admin removes a city that has no cameras in it.
        using (var scope = FunctionalTestSetup.ScopeFactory.CreateScope())
        {
            var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            context.VmsCities.Remove(await context.VmsCities.SingleAsync(c => c.Code == "bijar"));
            await context.SaveChangesAsync();
        }

        await SeedAsync();

        // A seeder that topped up missing codes would put بیجار back on every restart, silently and
        // for ever. All-or-nothing is the point, not an implementation shortcut.
        var after = await TestApp.AllAsync<VmsCity>();
        after.Count.ShouldBe(7);
        after.Select(c => c.Code).ShouldNotContain("bijar");
    }

    private static async Task SeedAsync()
    {
        using var scope = FunctionalTestSetup.ScopeFactory.CreateScope();
        var initialiser = scope.ServiceProvider.GetRequiredService<ApplicationDbContextInitialiser>();
        await initialiser.TrySeedAsync();
    }
}
