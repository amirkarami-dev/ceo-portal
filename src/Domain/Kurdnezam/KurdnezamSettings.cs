using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// Singleton site settings for the kurdnezam landing site (row <c>Id = 1</c>).
/// The organisation name is the only bilingual content in the site (fa / ku / en);
/// every other entity is single-language.
/// </summary>
public class KurdnezamSettings : BaseAuditableEntity
{
    public string NameFa { get; set; } = string.Empty;

    public string NameKu { get; set; } = string.Empty;

    public string NameEn { get; set; } = string.Empty;

    public string Tagline { get; set; } = string.Empty;

    public string Address { get; set; } = string.Empty;

    /// <summary>JSON array of contact phone numbers (nvarchar(max)).</summary>
    public string PhonesJson { get; set; } = "[]";

    public string PostalCode { get; set; } = string.Empty;

    public string Telegram { get; set; } = string.Empty;

    public string Instagram { get; set; } = string.Empty;

    /// <summary>
    /// Caption on the contact page's map panel. Empty falls back to <see cref="Address"/>, so the
    /// panel is never blank and the short form stays optional.
    /// </summary>
    public string MapLabel { get; set; } = string.Empty;

    /// <summary>Optional outbound map link, which turns the placeholder panel into something clickable.</summary>
    public string MapUrl { get; set; } = string.Empty;
}
