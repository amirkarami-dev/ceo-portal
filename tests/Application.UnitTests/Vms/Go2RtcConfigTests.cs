using Mabhas19.Application.Vms;
using Mabhas19.Domain.Vms;
using NUnit.Framework;
using Shouldly;

namespace Mabhas19.Application.UnitTests.Vms;

/// <summary>
/// The go2rtc <c>streams:</c> block the gateway hands to the VPS.
/// </summary>
/// <remarks>
/// The RTSP path spelling could not be guessed — 51 candidates all returned 400, and the real one had
/// to be read out of the camera's own JavaScript. It exists in exactly one place in this codebase, and
/// this is what stops a future edit quietly respelling it.
/// </remarks>
public class Go2RtcConfigTests
{
    private static Camera Camera(
        string key = "baneh-01",
        string cred = "default",
        string host = "78.39.233.70",
        int port = 554,
        int channel = 1,
        int sub = 2,
        int? main = null) => new()
        {
            Name = "دوربین",
            CityCode = "baneh",
            Host = host,
            RtspPort = port,
            StreamKey = key,
            CredentialKey = cred,
            Channel = channel,
            SubStreamId = sub,
            MainStreamId = main
        };

    [Test]
    public void A_camera_renders_the_path_step_1_discovered()
    {
        var yaml = Go2RtcConfig.Render([Camera()]);

        yaml.ShouldBe(
            "streams:\n"
            + "  baneh-01: 'rtsp://{{cred:default}}@78.39.233.70:554/mode=real&idc=1&ids=2'\n");
    }

    [Test]
    public void No_password_appears_anywhere_only_a_placeholder()
    {
        var yaml = Go2RtcConfig.Render([Camera()]);

        // The database has no password to leak, and this is the seam where one could be introduced
        // by accident. The VPS fills the placeholder; nothing before it can.
        yaml.ShouldContain("{{cred:default}}");
        yaml.ShouldNotContain("admin:");
    }

    [Test]
    public void The_main_stream_is_absent_unless_the_site_can_carry_it()
    {
        // Null is the normal case on the estate measured so far: 2560x1440 at ~11.2 Mbit/s against a
        // site uplink of ~0.41. A second entry would be a stream nobody can watch.
        Go2RtcConfig.Render([Camera(main: null)])
            .ShouldNotContain("-main");
    }

    [Test]
    public void A_site_that_can_carry_the_main_stream_gets_a_second_entry()
    {
        var yaml = Go2RtcConfig.Render([Camera(main: 1)]);

        yaml.ShouldContain("  baneh-01: 'rtsp://{{cred:default}}@78.39.233.70:554/mode=real&idc=1&ids=2'");
        yaml.ShouldContain("  baneh-01-main: 'rtsp://{{cred:default}}@78.39.233.70:554/mode=real&idc=1&ids=1'");
    }

    [Test]
    public void The_channel_and_stream_numbers_come_from_the_row()
    {
        Go2RtcConfig.Render([Camera(channel: 3, sub: 4)])
            .ShouldContain("idc=3&ids=4");
    }

    [Test]
    public void A_non_standard_port_is_carried_through()
        => Go2RtcConfig.Render([Camera(port: 8554)]).ShouldContain("@78.39.233.70:8554/");

    [Test]
    public void Cameras_are_ordered_so_the_file_does_not_churn()
    {
        // The sync script only restarts go2rtc when the rendered file changes. Unstable ordering
        // would restart it on every run, dropping every viewer for no reason.
        var yaml = Go2RtcConfig.Render(
        [
            Camera(key: "saqqez-01", host: "10.0.0.3"),
            Camera(key: "baneh-02", host: "10.0.0.1"),
            Camera(key: "marivan-01", host: "10.0.0.2"),
        ]);

        var order = yaml.Split('\n')
            .Where(l => l.StartsWith("  ", StringComparison.Ordinal))
            .Select(l => l.Trim().Split(':')[0])
            .ToList();

        order.ShouldBe(["baneh-02", "marivan-01", "saqqez-01"]);
    }

    [Test]
    public void An_empty_estate_still_renders_valid_yaml()
    {
        // "streams:" with nothing under it is not valid to go2rtc, and an empty file would leave the
        // cameras that were there before running with nothing to say the list is now empty.
        Go2RtcConfig.Render([]).ShouldBe("streams:\n  {}\n");
    }

    [Test]
    public void Each_camera_carries_its_own_credential_key()
    {
        var yaml = Go2RtcConfig.Render(
        [
            Camera(key: "baneh-01", cred: "default", host: "10.0.0.1"),
            Camera(key: "qorveh-01", cred: "qorveh", host: "10.0.0.2"),
        ]);

        // Sites do not have to share one login, and assuming they did would make a single wrong
        // password break every camera at once.
        yaml.ShouldContain("{{cred:default}}");
        yaml.ShouldContain("{{cred:qorveh}}");
    }
}
