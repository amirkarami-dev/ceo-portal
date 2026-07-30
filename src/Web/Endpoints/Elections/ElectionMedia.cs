using System.Text.RegularExpressions;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Domain.Constants;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Elections;

/// <summary>
/// Candidate photo upload and delivery. Auto-mapped to <c>/api/ElectionMedia</c>.
/// </summary>
/// <remarks>
/// <para>
/// Files go to the shared S3 (MinIO) store under this service's own <c>elections/</c> prefix — the
/// portal-wide rule is that every upload lands in object storage, in the folder belonging to the
/// service that owns it. Elections must not write into the CMS's <c>kurdnezam/</c> folder just because
/// an endpoint already exists there.
/// </para>
/// <para>
/// Modelled on <see cref="Kurdnezam.KurdnezamMedia"/>, with the limits tightened for what this actually
/// is. A candidate photo is a portrait, not a scanned بخشنامه: <b>images only</b> and 2 MB, against the
/// CMS's 20 MB and its document types. A narrower door is easier to defend and the admin panel offers
/// nothing else.
/// </para>
/// </remarks>
public partial class ElectionMedia : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/ElectionMedia";

    /// <summary>Objects live under this prefix; the route never accepts a raw object key.</summary>
    private const string Prefix = "elections/";

    private const long MaxBytes = 2 * 1024 * 1024;

    private static readonly Dictionary<string, string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/png"] = ".png",
        ["image/jpeg"] = ".jpg",
        ["image/webp"] = ".webp"
    };

    private static readonly Dictionary<string, string> ContentTypeByExtension = new(StringComparer.OrdinalIgnoreCase)
    {
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".webp"] = "image/webp"
    };

    // A stored file is always "<32 hex chars><known extension>". Anything else is rejected, so the
    // route cannot be walked into other prefixes of the bucket (reports/, kurdnezam/).
    [GeneratedRegex(@"^[a-f0-9]{32}\.(png|jpg|jpeg|webp)$", RegexOptions.IgnoreCase)]
    private static partial Regex FileNamePattern();

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapPost(UploadElectionMedia, string.Empty)
            .RequireAuthorization(policy => policy.RequireRole(Roles.Administrator))
            .DisableAntiforgery();

        groupBuilder.MapGet(GetElectionMedia, "{fileName}").AllowAnonymous();
    }

    /// <summary>Stores one candidate photo and returns the path to render it with.</summary>
    public static async Task<Results<Ok<ElectionMediaDto>, BadRequest<string>>> UploadElectionMedia(
        IFileStorage storage,
        IFormFile file,
        CancellationToken ct)
    {
        if (file.Length == 0)
            return TypedResults.BadRequest("فایل خالی است.");

        if (file.Length > MaxBytes)
            return TypedResults.BadRequest($"حجم تصویر بیشتر از {MaxBytes / (1024 * 1024)} مگابایت است.");

        if (!AllowedTypes.TryGetValue(file.ContentType ?? string.Empty, out var extension))
            return TypedResults.BadRequest("فقط تصویر با قالب PNG، JPG یا WebP پذیرفته می‌شود.");

        // Content-addressed by a fresh GUID: the uploaded name never reaches the bucket, so a candidate's
        // own file name cannot leak into a URL and two uploads can never collide.
        var fileName = $"{Guid.NewGuid():N}{extension}";

        await using var stream = file.OpenReadStream();
        await storage.PutAsync(Prefix + fileName, stream, file.ContentType!, ct);

        return TypedResults.Ok(new ElectionMediaDto(fileName, $"/api/ElectionMedia/{fileName}"));
    }

    /// <summary>
    /// Streams a stored photo back.
    /// </summary>
    /// <remarks>
    /// <para>
    /// <b>Anonymous, deliberately.</b> A browser does not attach an <c>Authorization</c> header to an
    /// <c>&lt;img src&gt;</c>, so an authenticated route would simply show broken images on the ballot.
    /// The alternatives are worse: presigned URLs expire while a voting window is still open, and
    /// proxying every photo through a token-aware fetch would put candidate images in memory for no gain.
    /// </para>
    /// <para>
    /// Nothing is exposed by this. A candidate photo is published to every voter by design, and the
    /// object name is 32 random hex characters, so the URL cannot be guessed or enumerated. It reveals
    /// nothing about who voted — that is the roll's job, and the roll is never reachable from here.
    /// </para>
    /// </remarks>
    public static async Task<Results<FileStreamHttpResult, NotFound>> GetElectionMedia(
        IFileStorage storage,
        HttpContext http,
        string fileName,
        CancellationToken ct)
    {
        if (!FileNamePattern().IsMatch(fileName))
            return TypedResults.NotFound();

        Stream stream;
        try
        {
            stream = await storage.GetAsync(Prefix + fileName, ct);
        }
        catch (Exception)
        {
            // Storage throws provider-specific "no such key" exceptions; a missing image is a 404.
            return TypedResults.NotFound();
        }

        var extension = Path.GetExtension(fileName);
        var contentType = ContentTypeByExtension.GetValueOrDefault(extension, "application/octet-stream");

        // File names are content-addressed by a fresh GUID, so a stored object never changes.
        http.Response.Headers.CacheControl = "public, max-age=31536000, immutable";

        return TypedResults.Stream(stream, contentType);
    }
}

/// <summary>The stored photo and the path to render it with.</summary>
/// <param name="FileName">Storage key inside the prefix, e.g. <c>{32-hex}.jpg</c>.</param>
/// <param name="Url">Server-relative URL; the SPA resolves it with <c>mediaUrl()</c>.</param>
public sealed record ElectionMediaDto(string FileName, string Url);
