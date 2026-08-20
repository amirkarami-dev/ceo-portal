using Shouldly;
using Mabhas19.Application.Rooms;
using NUnit.Framework;

namespace Mabhas19.Application.UnitTests.Rooms;

/// <summary>
/// Turning a caller's file name into a storage key.
/// </summary>
/// <remarks>
/// This is the one place a meeting's files let untrusted text near a path. The name arrives from a
/// browser, so it can contain separators, traversal, or nothing useful at all — and two people
/// uploading «سند.pdf» to the same meeting must not overwrite one another.
/// </remarks>
public class RoomFileRuleTests
{
    [Test]
    public void The_key_is_scoped_to_its_room()
    {
        RoomFileRules.KeyFor(12, "agenda.pdf").ShouldStartWith("rooms/12/");
    }

    [TestCase("سند.pdf")]
    [TestCase("report.docx")]
    [TestCase("../../etc/passwd")]
    [TestCase("C:\\Users\\admin\\secret.txt")]
    [TestCase("..\\..\\web.config")]
    public void The_callers_name_never_reaches_the_key(string fileName)
    {
        var key = RoomFileRules.KeyFor(7, fileName);

        // Nothing of the supplied name survives except, at most, its extension.
        key.ShouldNotContain("سند");
        key.ShouldNotContain("report");
        key.ShouldNotContain("passwd");
        key.ShouldNotContain("secret");
        key.ShouldNotContain("web.config");

        // And it cannot climb out of its own folder.
        key.ShouldNotContain("..");
        key.ShouldNotContain("\\");
        key.Split('/').Length.ShouldBe(3, $"key was {key}");
    }

    [Test]
    public void Two_uploads_of_the_same_name_do_not_collide()
    {
        var a = RoomFileRules.KeyFor(3, "سند.pdf");
        var b = RoomFileRules.KeyFor(3, "سند.pdf");

        a.ShouldNotBe(b);
    }

    [Test]
    public void A_normal_extension_is_kept_so_the_object_is_recognisable()
    {
        RoomFileRules.KeyFor(3, "agenda.pdf").ShouldEndWith(".pdf");
    }

    [TestCase("payload.a-very-long-extension-indeed")]
    [TestCase("odd.na/me")]
    [TestCase("noextension")]
    public void An_extension_that_is_not_plainly_an_extension_is_dropped(string fileName)
    {
        var key = RoomFileRules.KeyFor(3, fileName);

        // rooms/3/<32 hex> and nothing more.
        key.Split('/')[2].Length.ShouldBe(32, $"key was {key}");
    }

    [Test]
    public void The_limits_are_the_ones_the_messages_promise()
    {
        // The refusal text says «حداکثر ۲۰ مگابایت» and «حداکثر ۱۰ فایل»; if these move, that text
        // becomes a lie, and nothing else would notice.
        RoomFileRules.MaxFileBytes.ShouldBe(20L * 1024 * 1024);
        RoomFileRules.MaxFilesPerRoom.ShouldBe(10);
    }
}
