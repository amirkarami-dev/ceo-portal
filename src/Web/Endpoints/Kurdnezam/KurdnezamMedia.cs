using System.Text.RegularExpressions;
using Mabhas19.Application.Common.Interfaces;
using Microsoft.AspNetCore.Http.HttpResults;

namespace Mabhas19.Web.Endpoints.Kurdnezam;

/// <summary>
/// Image upload + delivery for the kurdnezam CMS.
/// </summary>
/// <remarks>
/// Uploads go to MinIO; delivery is streamed back through this endpoint rather than via a
/// presigned URL, because presigned URLs expire and these URLs are persisted on content rows
/// that a public site renders indefinitely. Streaming also keeps the bucket private.
/// </remarks>
public partial class KurdnezamMedia : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/kurdnezam/media";

    /// <summary>Objects live under this prefix; the route never accepts a raw object key.</summary>
    private const string Prefix = "kurdnezam/";

    // News attachments are scanned بخشنامه / forms, which are far bigger than a thumbnail.
    private const long MaxBytes = 20 * 1024 * 1024;

    private static readonly Dictionary<string, string> AllowedTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        ["image/png"] = ".png",
        ["image/jpeg"] = ".jpg",
        ["image/webp"] = ".webp",
        ["image/gif"] = ".gif",
        // Documents, for news attachments.
        ["application/pdf"] = ".pdf",
        ["application/msword"] = ".doc",
        ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] = ".docx",
        ["application/vnd.ms-excel"] = ".xls",
        ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"] = ".xlsx"
    };

    private static readonly Dictionary<string, string> ContentTypeByExtension = new(StringComparer.OrdinalIgnoreCase)
    {
        [".png"] = "image/png",
        [".jpg"] = "image/jpeg",
        [".jpeg"] = "image/jpeg",
        [".webp"] = "image/webp",
        [".gif"] = "image/gif",
        [".pdf"] = "application/pdf",
        [".doc"] = "application/msword",
        [".docx"] = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        [".xls"] = "application/vnd.ms-excel",
        [".xlsx"] = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    };

    // A stored file is always "<32 hex chars><known extension>". Anything else is rejected, so the
    // route cannot be walked into other prefixes of the bucket (e.g. reports/).
    [GeneratedRegex(@"^[a-f0-9]{32}\.(png|jpg|jpeg|webp|gif|pdf|doc|docx|xls|xlsx)$", RegexOptions.IgnoreCase)]
    private static partial Regex FileNamePattern();

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapPost(UploadKurdnezamMedia, string.Empty).RequireAdmin().DisableAntiforgery();
        groupBuilder.MapGet(GetKurdnezamMedia, "{fileName}").AllowAnonymous();
    }

    public static async Task<Results<Ok<KurdnezamMediaDto>, BadRequest<string>>> UploadKurdnezamMedia(
        IFileStorage storage,
        IFormFile file,
        CancellationToken ct)
    {
        if (file.Length == 0)
            return TypedResults.BadRequest("The file is empty.");

        if (file.Length > MaxBytes)
            return TypedResults.BadRequest($"The file exceeds the {MaxBytes / (1024 * 1024)} MB limit.");

        if (!AllowedTypes.TryGetValue(file.ContentType ?? string.Empty, out var extension))
            return TypedResults.BadRequest($"Unsupported image type. Allowed: {string.Join(", ", AllowedTypes.Keys)}.");

        var fileName = $"{Guid.NewGuid():N}{extension}";

        await using var stream = file.OpenReadStream();
        await storage.PutAsync(Prefix + fileName, stream, file.ContentType!, ct);

        return TypedResults.Ok(new KurdnezamMediaDto(
            fileName,
            $"/api/kurdnezam/media/{fileName}",
            Path.GetFileName(file.FileName),
            file.ContentType!,
            file.Length));
    }

    /// <param name="name">
    /// Optional original file name. Attachments are served from the API host while the site runs on
    /// another origin, where the HTML <c>download</c> attribute is ignored — so the download name has
    /// to come from the server instead.
    /// </param>
    public static async Task<Results<FileStreamHttpResult, NotFound>> GetKurdnezamMedia(
        IFileStorage storage,
        HttpContext http,
        string fileName,
        CancellationToken ct,
        string? name = null)
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

        // filename* (RFC 5987) so Persian names survive; plain `filename` would mangle them.
        if (!string.IsNullOrWhiteSpace(name))
        {
            http.Response.Headers.ContentDisposition =
                $"attachment; filename*=UTF-8''{Uri.EscapeDataString(name)}";
        }

        return TypedResults.Stream(stream, contentType);
    }
}

/// <summary>The stored file and the URL to render it with, plus what the editor uploaded.</summary>
/// <param name="FileName">Storage key, e.g. <c>{32-hex}.pdf</c>.</param>
/// <param name="Url">Server-relative URL to fetch it back.</param>
/// <param name="OriginalName">Name as uploaded — kept so attachments download under it.</param>
/// <param name="ContentType">MIME type as uploaded.</param>
/// <param name="SizeBytes">Size, so the UI can show it without re-fetching.</param>
public sealed record KurdnezamMediaDto(
    string FileName,
    string Url,
    string OriginalName,
    string ContentType,
    long SizeBytes);
