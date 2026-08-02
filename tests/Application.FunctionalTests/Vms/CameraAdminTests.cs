using Mabhas19.Application.Vms;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Vms;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.FunctionalTests.Vms;

/// <summary>
/// Admin CRUD for cameras, through the real pipeline and a real database.
/// </summary>
/// <remarks>
/// This is step 3's success criterion — <b>a camera can be added and tagged</b>. It needs a real
/// database because the city is a foreign key and the stream key is a unique index, and a handler
/// that drifts from either turns a clear Persian message into an unexplained 500.
/// </remarks>
public class CameraAdminTests : TestBase
{
    private const string Baneh = "baneh";
    private const string Marivan = "marivan";

    private static CameraInput Input(
        string name = "دوربین راه‌پله",
        string cityCode = Baneh,
        string host = "78.39.233.70",
        int channel = 1,
        int? mainStreamId = null) => new(
        Name: name,
        CityCode: cityCode,
        Host: host,
        RtspPort: 554,
        CredentialKey: "default",
        Channel: channel,
        SubStreamId: 2,
        MainStreamId: mainStreamId,
        IsActive: true,
        Notes: null);

    private static async Task SeedCitiesAsync()
    {
        await TestApp.AddAsync(new VmsCity { Code = Baneh, Name = "بانه", DisplayOrder = 10 });
        await TestApp.AddAsync(new VmsCity { Code = Marivan, Name = "مریوان", DisplayOrder = 20 });
    }

    // ── the step 3 criterion ─────────────────────────────────────────────────

    [Test]
    public async Task A_camera_can_be_added_and_tagged_with_its_city()
    {
        await TestApp.RunAsAdministratorAsync();
        await SeedCitiesAsync();

        var id = await TestApp.SendAsync(new CreateCameraCommand(Input()));

        var camera = await TestApp.SendAsync(new GetCameraQuery(id));

        camera.Name.ShouldBe("دوربین راه‌پله");
        camera.CityCode.ShouldBe(Baneh);
        camera.CityName.ShouldBe("بانه");
        camera.Host.ShouldBe("78.39.233.70");
        camera.SubStreamId.ShouldBe(2);
        camera.CredentialKey.ShouldBe("default");

        // Null, and that is the finding of step 1 rather than an unfilled field: this site uploads
        // ~0.41 Mbit/s and its main stream needs ~11.2.
        camera.MainStreamId.ShouldBeNull();
    }

    [Test]
    public async Task The_stream_key_is_generated_from_the_city_and_never_typed()
    {
        await TestApp.RunAsAdministratorAsync();
        await SeedCitiesAsync();

        var first = await TestApp.SendAsync(new CreateCameraCommand(Input(host: "10.0.0.1")));
        var second = await TestApp.SendAsync(new CreateCameraCommand(Input(host: "10.0.0.2")));

        (await TestApp.SendAsync(new GetCameraQuery(first))).StreamKey.ShouldBe("baneh-01");
        (await TestApp.SendAsync(new GetCameraQuery(second))).StreamKey.ShouldBe("baneh-02");
    }

    [Test]
    public async Task Cameras_can_be_listed_by_city()
    {
        await TestApp.RunAsAdministratorAsync();
        await SeedCitiesAsync();

        await TestApp.SendAsync(new CreateCameraCommand(Input(host: "10.0.0.1")));
        await TestApp.SendAsync(new CreateCameraCommand(
            Input(name: "دوربین میدان", cityCode: Marivan, host: "10.0.0.2")));

        (await TestApp.SendAsync(new GetCamerasQuery())).Count.ShouldBe(2);

        var marivan = await TestApp.SendAsync(new GetCamerasQuery(Marivan));
        marivan.Count.ShouldBe(1);
        marivan[0].Name.ShouldBe("دوربین میدان");
        marivan[0].CityName.ShouldBe("مریوان");
    }

    [Test]
    public async Task The_city_list_carries_how_many_cameras_each_holds()
    {
        await TestApp.RunAsAdministratorAsync();
        await SeedCitiesAsync();
        await TestApp.SendAsync(new CreateCameraCommand(Input()));

        var cities = await TestApp.SendAsync(new GetVmsCitiesQuery());

        cities.Single(c => c.Code == Baneh).CameraCount.ShouldBe(1);

        // Not null and not absent: an empty city is a city the admin can still add a camera to, and
        // the panel needs to tell it apart from one it should grey out.
        cities.Single(c => c.Code == Marivan).CameraCount.ShouldBe(0);
    }

    // ── the city is a real reference, not free text ──────────────────────────

    [Test]
    public async Task A_camera_in_a_city_that_does_not_exist_is_refused_with_a_sentence()
    {
        await TestApp.RunAsAdministratorAsync();
        await SeedCitiesAsync();

        // The foreign key would refuse it anyway — as a DbUpdateException carrying a constraint name,
        // which reaches the admin as an unexplained 500.
        var ex = await Should.ThrowAsync<ValidationException>(
            TestApp.SendAsync(new CreateCameraCommand(Input(cityCode: "nowhere"))));

        ex.Errors.ShouldContainKey(nameof(CameraInput.CityCode));
    }

    [Test]
    public async Task A_city_switched_off_cannot_take_new_cameras()
    {
        await TestApp.RunAsAdministratorAsync();
        await TestApp.AddAsync(new VmsCity
        {
            Code = Baneh, Name = "بانه", DisplayOrder = 10, IsActive = false
        });

        // The database has no opinion about an inactive city — only this check does.
        var ex = await Should.ThrowAsync<ValidationException>(
            TestApp.SendAsync(new CreateCameraCommand(Input())));

        ex.Errors[nameof(CameraInput.CityCode)].ShouldContain("این شهر غیرفعال است");
    }

    [Test]
    public async Task An_inactive_city_is_hidden_from_the_picker_but_can_still_be_listed()
    {
        await TestApp.RunAsAdministratorAsync();
        await SeedCitiesAsync();
        await TestApp.AddAsync(new VmsCity
        {
            Code = "old", Name = "شهر قدیمی", DisplayOrder = 99, IsActive = false
        });

        (await TestApp.SendAsync(new GetVmsCitiesQuery())).Count.ShouldBe(2);
        (await TestApp.SendAsync(new GetVmsCitiesQuery(IncludeInactive: true))).Count.ShouldBe(3);
    }

    // ── one puller per camera ────────────────────────────────────────────────

    [Test]
    public async Task A_second_camera_on_the_same_address_and_channel_is_refused()
    {
        await TestApp.RunAsAdministratorAsync();
        await SeedCitiesAsync();

        await TestApp.SendAsync(new CreateCameraCommand(Input()));

        // Two rows for one physical stream means go2rtc opens two sessions against a link that has
        // room for one, and both starve. The symptom looks like a fault at the site, not a duplicate
        // row, which is why this is refused at the point of typing rather than discovered later.
        var ex = await Should.ThrowAsync<ValidationException>(
            TestApp.SendAsync(new CreateCameraCommand(Input(name: "همان دوربین"))));

        ex.Errors.ShouldContainKey(nameof(CameraInput.Host));
    }

    [Test]
    public async Task The_same_address_on_a_different_channel_is_allowed()
    {
        await TestApp.RunAsAdministratorAsync();
        await SeedCitiesAsync();

        await TestApp.SendAsync(new CreateCameraCommand(Input(channel: 1)));

        // A four-channel recorder behind one address is a real arrangement, and each channel is its
        // own picture.
        await TestApp.SendAsync(new CreateCameraCommand(Input(name: "کانال ۲", channel: 2)));

        (await TestApp.SendAsync(new GetCamerasQuery())).Count.ShouldBe(2);
    }

    [Test]
    public async Task A_camera_can_be_saved_over_itself_without_tripping_the_duplicate_check()
    {
        await TestApp.RunAsAdministratorAsync();
        await SeedCitiesAsync();

        var id = await TestApp.SendAsync(new CreateCameraCommand(Input()));

        // The clash query has to exclude the row being edited, or renaming a camera would report it
        // as a duplicate of itself.
        await TestApp.SendAsync(new UpdateCameraCommand(id, Input(name: "نام تازه")));

        (await TestApp.SendAsync(new GetCameraQuery(id))).Name.ShouldBe("نام تازه");
    }

    // ── update, deactivate, delete ───────────────────────────────────────────

    [Test]
    public async Task Moving_a_camera_to_another_city_keeps_its_stream_key()
    {
        await TestApp.RunAsAdministratorAsync();
        await SeedCitiesAsync();

        var id = await TestApp.SendAsync(new CreateCameraCommand(Input()));

        await TestApp.SendAsync(new UpdateCameraCommand(id, Input(cityCode: Marivan)));

        var camera = await TestApp.SendAsync(new GetCameraQuery(id));
        camera.CityCode.ShouldBe(Marivan);

        // The key is an identifier, not a label. go2rtc's config and every open tab already use it,
        // so renaming it on a move would break a working stream to tidy up a string.
        camera.StreamKey.ShouldBe("baneh-01");
    }

    [Test]
    public async Task A_camera_can_be_switched_off_without_being_deleted()
    {
        await TestApp.RunAsAdministratorAsync();
        await SeedCitiesAsync();
        var id = await TestApp.SendAsync(new CreateCameraCommand(Input()));

        await TestApp.SendAsync(new SetCameraActiveCommand(id, false));

        (await TestApp.SendAsync(new GetCameraQuery(id))).IsActive.ShouldBeFalse();

        // Still in the admin list — switching a camera off must not hide it from the person who has
        // to switch it back on.
        (await TestApp.SendAsync(new GetCamerasQuery())).Count.ShouldBe(1);
    }

    [Test]
    public async Task A_deleted_camera_leaves_the_list_but_keeps_its_stream_key_reserved()
    {
        await TestApp.RunAsAdministratorAsync();
        await SeedCitiesAsync();
        var id = await TestApp.SendAsync(new CreateCameraCommand(Input()));

        await TestApp.SendAsync(new DeleteCameraCommand(id));

        (await TestApp.SendAsync(new GetCamerasQuery())).ShouldBeEmpty();

        var next = await TestApp.SendAsync(new CreateCameraCommand(Input(host: "10.0.0.9")));

        // baneh-01 is gone for good. Reusing it would let a stale go2rtc entry, or a tab somebody
        // left open, show a different camera than the one it names.
        (await TestApp.SendAsync(new GetCameraQuery(next))).StreamKey.ShouldBe("baneh-02");
    }

    [Test]
    public async Task Deleting_a_camera_twice_is_refused_rather_than_silently_repeated()
    {
        await TestApp.RunAsAdministratorAsync();
        await SeedCitiesAsync();
        var id = await TestApp.SendAsync(new CreateCameraCommand(Input()));

        await TestApp.SendAsync(new DeleteCameraCommand(id));

        await Should.ThrowAsync<NotFoundException>(
            TestApp.SendAsync(new DeleteCameraCommand(id)));
    }

    // ── authorisation ────────────────────────────────────────────────────────

    [Test]
    public async Task A_signed_in_non_administrator_cannot_add_a_camera()
    {
        await SeedCitiesAsync();
        await TestApp.RunAsDefaultUserAsync();

        // Every route in this service is Administrator-only. There is no per-city permission because
        // there is no non-admin audience: a city is classification, not access.
        await Should.ThrowAsync<Common.Exceptions.ForbiddenAccessException>(
            TestApp.SendAsync(new CreateCameraCommand(Input())));
    }

    [Test]
    public async Task A_signed_in_non_administrator_cannot_list_cameras()
    {
        await SeedCitiesAsync();
        await TestApp.RunAsDefaultUserAsync();

        await Should.ThrowAsync<Common.Exceptions.ForbiddenAccessException>(
            TestApp.SendAsync(new GetCamerasQuery()));
    }

    // ── nothing here can leak a camera ───────────────────────────────────────

    [Test]
    public async Task No_admin_response_carries_anything_password_shaped()
    {
        await TestApp.RunAsAdministratorAsync();
        await SeedCitiesAsync();
        var id = await TestApp.SendAsync(new CreateCameraCommand(Input()));

        // The design's promise is that CeoDb can describe every camera and open none of them. The
        // DTOs are the other half of that: CredentialKey names a secret, it is never the secret.
        var detail = await TestApp.SendAsync(new GetCameraQuery(id));

        var names = typeof(CameraDetailDto).GetProperties().Select(p => p.Name).ToList();
        names.ShouldNotContain(n => n.Contains("password", StringComparison.OrdinalIgnoreCase));
        names.ShouldNotContain(n => n.Contains("secret", StringComparison.OrdinalIgnoreCase));
        detail.CredentialKey.ShouldBe("default");
    }
}
