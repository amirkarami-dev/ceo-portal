using Mabhas19.Application.Vms;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Vms;

/// <summary>
/// The names a camera validation error comes back under, and the pure rules behind them.
/// </summary>
/// <remarks>
/// The key half of this looks like a test of a library and is not. The request body an admin posts IS
/// a <see cref="CameraInput"/>; the command wrapping it is a server-side detail. FluentValidation's
/// default for a child validator prefixes every key with the parent property, so the API would answer
/// <c>Input.Host</c> to a form whose field is <c>host</c> — "this failed", with nothing highlighted.
/// The room service shipped exactly that; nothing about it is visible in a passing build.
/// </remarks>
public class CameraValidationKeyTests
{
    private static CameraInput Valid() => new(
        Name: "دوربین راه‌پله",
        CityCode: "baneh",
        Host: "78.39.233.70",
        RtspPort: 554,
        CredentialKey: "default",
        Channel: 1,
        SubStreamId: 2,
        MainStreamId: null,
        IsActive: true,
        Notes: null);

    private static string[] CreateKeys(CameraInput input) =>
        [.. new CreateCameraCommandValidator()
            .Validate(new CreateCameraCommand(input))
            .Errors
            .Select(e => e.PropertyName)];

    private static string[] UpdateKeys(CameraInput input) =>
        [.. new UpdateCameraCommandValidator()
            .Validate(new UpdateCameraCommand(1, input))
            .Errors
            .Select(e => e.PropertyName)];

    // ── the keys stay flat ───────────────────────────────────────────────────

    [Test]
    public void A_valid_camera_produces_no_errors()
        => CreateKeys(Valid()).ShouldBeEmpty();

    [Test]
    public void No_error_key_is_ever_dotted_on_create()
    {
        // Every rule broken at once, so one assertion covers the whole validator rather than the
        // handful of fields a future edit happens to leave alone.
        var keys = CreateKeys(new CameraInput(
            Name: "", CityCode: "", Host: "http://cam/", RtspPort: 0,
            CredentialKey: "Bad Key", Channel: 0, SubStreamId: 0, MainStreamId: 0,
            IsActive: true, Notes: new string('x', 1001)));

        keys.ShouldNotBeEmpty();
        keys.ShouldAllBe(k => !k.Contains('.'));
    }

    [Test]
    public void No_error_key_is_ever_dotted_on_update()
    {
        var keys = UpdateKeys(Valid() with { Name = "  ", Host = "  " });

        keys.ShouldNotBeEmpty();
        keys.ShouldAllBe(k => !k.Contains('.'));
    }

    [Test]
    public void An_empty_name_is_reported_as_Name_not_Input_Name()
        => CreateKeys(Valid() with { Name = "  " }).ShouldContain(nameof(CameraInput.Name));

    [Test]
    public void The_two_streams_being_equal_is_reported_on_MainStreamId()
        => CreateKeys(Valid() with { MainStreamId = 2, SubStreamId = 2 })
            .ShouldContain(nameof(CameraInput.MainStreamId));

    // ── the host has to be a host ────────────────────────────────────────────

    [TestCase("78.39.233.70")]
    [TestCase("cam-01.example.ir")]
    [TestCase("a")]
    public void A_plain_address_or_hostname_is_accepted(string host)
        => CameraRules.IsValidHost(host).ShouldBeTrue();

    [TestCase("http://78.39.233.70")]   // a scheme belongs to the URL we build, not to the field
    [TestCase("78.39.233.70:554")]      // the port is its own column
    [TestCase("78.39.233.70/stream")]   // the path comes from Channel + SubStreamId
    [TestCase("cam 01")]
    [TestCase("")]
    [TestCase("-cam")]
    public void Anything_that_is_not_a_bare_host_is_refused(string host)
        => CameraRules.IsValidHost(host).ShouldBeFalse();

    [Test]
    public void A_host_longer_than_a_dns_name_is_refused()
        => CameraRules.IsValidHost(new string('a', 254)).ShouldBeFalse();

    // ── stream keys ──────────────────────────────────────────────────────────

    [Test]
    public void The_first_camera_in_a_city_is_numbered_01()
        => CameraRules.NextStreamKey("baneh", []).ShouldBe("baneh-01");

    [Test]
    public void Numbering_continues_past_the_keys_already_in_use()
        => CameraRules.NextStreamKey("baneh", ["baneh-01", "baneh-02", "marivan-01"])
            .ShouldBe("baneh-03");

    [Test]
    public void A_gap_left_by_a_deleted_camera_is_filled_only_if_its_key_is_gone()
    {
        // The caller passes deleted cameras too, so the hole in the middle stays reserved. A recycled
        // key would let a stale go2rtc entry — or a tab somebody left open — show a different camera
        // than the one it names.
        CameraRules.NextStreamKey("baneh", ["baneh-01", "baneh-02", "baneh-03"]).ShouldBe("baneh-04");
    }

    [Test]
    public void An_existing_key_is_matched_regardless_of_case()
        => CameraRules.NextStreamKey("baneh", ["BANEH-01"]).ShouldBe("baneh-02");

    [Test]
    public void A_city_code_that_is_not_ascii_still_yields_a_usable_key()
    {
        // Cities are rows, so somebody can add one with a Persian code. The key still has to be
        // something go2rtc and a URL can carry.
        var key = CameraRules.NextStreamKey("سنندج", []);

        CameraRules.IsValidSlug(key).ShouldBeTrue();
        key.ShouldBe("cam-01");
    }

    [TestCase("default", true)]
    [TestCase("baneh-01", true)]
    [TestCase("Default", false)]
    [TestCase("has space", false)]
    [TestCase("trailing-", false)]
    [TestCase("", false)]
    public void Credential_keys_are_lower_case_slugs(string key, bool expected)
        => CameraRules.IsValidSlug(key).ShouldBe(expected);
}
