using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// A file attached to a news article — the scanned بخشنامه / اطلاعیه, a form, a spreadsheet.
/// </summary>
/// <remarks>
/// Only the reference is stored here; the bytes live in MinIO behind
/// <c>/api/kurdnezam/media/{fileName}</c>, exactly like <see cref="KurdnezamNews.Image"/>.
/// <see cref="FileName"/> keeps the name the editor uploaded so the visitor downloads
/// "بخشنامه ۱۴۰۵.pdf" rather than the opaque 32-hex storage key.
/// </remarks>
public class KurdnezamNewsAttachment : BaseAuditableEntity
{
    public int NewsId { get; set; }

    public KurdnezamNews? News { get; set; }

    /// <summary>Stored reference, e.g. <c>/api/kurdnezam/media/{32-hex}.pdf</c>.</summary>
    public string Url { get; set; } = string.Empty;

    /// <summary>Original file name, shown and used as the download name.</summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>MIME type as uploaded; drives the icon shown in the UI.</summary>
    public string ContentType { get; set; } = string.Empty;

    /// <summary>Size in bytes, so the site can show "۲٫۴ مگابایت" before the visitor clicks.</summary>
    public long SizeBytes { get; set; }

    /// <summary>Display order inside the article. Lower shows first.</summary>
    public int SortOrder { get; set; }
}
