using System.Reflection;
using System.Text.RegularExpressions;

namespace Mabhas19.Application.FunctionalTests.Elections;

/// <summary>
/// Pins the storage rules for candidate photos.
/// </summary>
/// <remarks>
/// <para>
/// The portal rule is that every upload goes to the shared S3 store <b>under the folder belonging to the
/// service that owns it</b>. Elections must not write into <c>kurdnezam/</c> just because an endpoint
/// already exists there, and the delivery route must not be walkable into another service's folder.
/// </para>
/// <para>
/// Reached by reflection because the endpoint's constants are private — they are private on purpose, and
/// the alternative (making them public just to test them) would weaken the thing being tested.
/// </para>
/// </remarks>
public class ElectionMediaTests
{
    private static readonly Type Endpoint = typeof(Mabhas19.Web.Endpoints.Elections.ElectionMedia);

    private static T Const<T>(string name) =>
        (T)Endpoint.GetField(name, BindingFlags.NonPublic | BindingFlags.Static)!.GetRawConstantValue()!;

    private static Regex FileNamePattern() =>
        (Regex)Endpoint
            .GetMethod("FileNamePattern", BindingFlags.NonPublic | BindingFlags.Static)!
            .Invoke(null, null)!;

    [Test]
    public void Photos_go_to_the_elections_folder_not_the_cms_one()
        => Const<string>("Prefix").ShouldBe("elections/");

    [Test]
    public void The_size_cap_is_portrait_sized_not_document_sized()
    {
        // The CMS allows 20 MB because it stores scanned بخشنامه. This stores a face.
        Const<long>("MaxBytes").ShouldBe(2 * 1024 * 1024);
    }

    [Test]
    public void Only_image_names_are_servable()
    {
        var p = FileNamePattern();

        p.IsMatch("0123456789abcdef0123456789abcdef.jpg").ShouldBeTrue();
        p.IsMatch("0123456789abcdef0123456789abcdef.png").ShouldBeTrue();
        p.IsMatch("0123456789abcdef0123456789abcdef.webp").ShouldBeTrue();
    }

    [Test]
    public void Documents_are_not_servable_even_if_one_reached_the_bucket()
    {
        // The CMS pattern accepts pdf/doc/xls. This one must not: a document under elections/ could
        // only have arrived by mistake or by another route, and serving it is not this endpoint's job.
        var p = FileNamePattern();

        p.IsMatch("0123456789abcdef0123456789abcdef.pdf").ShouldBeFalse();
        p.IsMatch("0123456789abcdef0123456789abcdef.docx").ShouldBeFalse();
        p.IsMatch("0123456789abcdef0123456789abcdef.svg").ShouldBeFalse();
    }

    [Test]
    public void The_route_cannot_be_walked_into_another_services_folder()
    {
        // This is the guard that matters. Without it, "../reports/x" or a bare key would let the
        // anonymous GET stream somebody's assessment report out of the same bucket.
        var p = FileNamePattern();

        p.IsMatch("../reports/secret.pdf").ShouldBeFalse();
        p.IsMatch("../../kurdnezam/logo.png").ShouldBeFalse();
        p.IsMatch("reports/x.jpg").ShouldBeFalse();
        p.IsMatch("/etc/passwd").ShouldBeFalse();
        p.IsMatch("0123456789abcdef0123456789abcdef.jpg/../../x").ShouldBeFalse();
    }

    [Test]
    public void A_name_that_is_not_content_addressed_is_refused()
    {
        // Uploads are renamed to 32 hex characters, so anything else was not produced by this endpoint.
        var p = FileNamePattern();

        p.IsMatch("photo.jpg").ShouldBeFalse();
        p.IsMatch("0123456789abcdef.jpg").ShouldBeFalse();          // too short
        p.IsMatch("0123456789abcdef0123456789abcdefff.jpg").ShouldBeFalse(); // too long
        p.IsMatch("zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz.jpg").ShouldBeFalse();   // not hex
        p.IsMatch("0123456789abcdef0123456789abcdef.jpg ").ShouldBeFalse();  // trailing space
    }
}
