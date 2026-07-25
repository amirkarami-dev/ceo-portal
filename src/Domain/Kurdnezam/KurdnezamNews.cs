using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// A news article / announcement.
/// </summary>
/// <remarks>
/// <see cref="DateJalali"/> is stored verbatim as the Persian-numeral Jalali string the site
/// renders (e.g. <c>۱۴۰۵/۴/۲۱</c>); the frontend parses it by splitting on '/'. <see cref="PublishedAt"/>
/// carries the real instant so the API can sort reliably without parsing Jalali.
/// <para>
/// <see cref="UnitId"/> replaces the frontend's fragile "match the unit title as a substring of the
/// news title" heuristic with a real foreign key.
/// </para>
/// </remarks>
public class KurdnezamNews : BaseAuditableEntity
{
    public string Title { get; set; } = string.Empty;

    public string Summary { get; set; } = string.Empty;

    /// <summary>Article body. Paragraphs are separated by a blank line ("\n\n").</summary>
    public string Body { get; set; } = string.Empty;

    /// <summary>Jalali date as displayed, e.g. <c>۱۴۰۵/۴/۲۱</c>.</summary>
    public string DateJalali { get; set; } = string.Empty;

    /// <summary>Real publication instant, used for ordering.</summary>
    public DateTimeOffset PublishedAt { get; set; }

    public string Author { get; set; } = string.Empty;

    public int CategoryId { get; set; }

    public KurdnezamCategory? Category { get; set; }

    /// <summary>Optional owning organisational unit (formalises the old title-substring match).</summary>
    public int? UnitId { get; set; }

    public KurdnezamUnit? Unit { get; set; }

    /// <summary>Image URL: a static <c>/images/...</c> path or an uploaded <c>/api/kurdnezam/media/...</c> key.</summary>
    public string Image { get; set; } = string.Empty;

    /// <summary>Highlights the article; queryable via <c>?featured=true</c>.</summary>
    public bool Featured { get; set; }

    /// <summary>Downloadable files (بخشنامه / فرم / اطلاعیه). Deleted with the article.</summary>
    public ICollection<KurdnezamNewsAttachment> Attachments { get; set; } = new List<KurdnezamNewsAttachment>();
}
