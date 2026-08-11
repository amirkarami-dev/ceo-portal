namespace Mabhas19.Application.Kurdnezam.Forms;

/// <summary>
/// One file a member attached, handed to the submit command by the web layer.
/// </summary>
/// <remarks>
/// An interface rather than <c>IFormFile</c> so the Application layer keeps no reference to
/// ASP.NET. The handler needs the stream itself — it validates, uploads and saves in one place, so
/// a failed save can delete what it just uploaded instead of leaving objects behind.
/// </remarks>
public interface IKurdnezamFormUpload
{
    /// <summary>Which field of the form this file belongs to.</summary>
    int FieldId { get; }

    /// <summary>The name on the member's machine. Kept so an administrator downloads it by name.</summary>
    string FileName { get; }

    string ContentType { get; }

    long SizeBytes { get; }

    Stream OpenRead();
}

/// <summary>
/// What a public submission may carry. Deliberately tighter than the administrator upload route
/// (<c>KurdnezamMedia</c>, 20 MB and more types): anyone on the internet can reach this one.
/// </summary>
public static class KurdnezamFormUploadLimits
{
    public const long MaxBytesPerFile = 5 * 1024 * 1024;

    public const int MaxFilesPerField = 3;

    public const long MaxBytesPerSubmission = 15 * 1024 * 1024;

    /// <summary>Content type → file extension. Narrow on purpose.</summary>
    public static readonly IReadOnlyDictionary<string, string> AllowedTypes =
        new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["application/pdf"] = ".pdf",
            ["image/jpeg"] = ".jpg",
            ["image/png"] = ".png",
            ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"] = ".docx",
        };

    /// <summary>Objects live under this prefix, apart from public media.</summary>
    public const string StoragePrefix = "kurdnezam/form-uploads/";

    public static string Describe() =>
        $"PDF، JPG، PNG یا DOCX، حداکثر {MaxBytesPerFile / (1024 * 1024)} مگابایت";
}
