using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>What a member typed into one text field of a <see cref="KurdnezamFormSubmission"/>.</summary>
/// <remarks>
/// <para>
/// <see cref="FieldId"/> is a plain number, <b>not</b> a foreign key, and <see cref="FieldLabel"/>
/// is a copy of the label taken at the moment of sending. Two reasons, both deliberate:
/// </para>
/// <list type="number">
/// <item>
/// An administrator who deletes a field must not delete what people already sent. With a real
/// foreign key that answer would either be deleted with the field or block the delete. Here it
/// simply stays, and still reads correctly because it carries its own label.
/// </item>
/// <item>
/// A foreign key would also give SQL Server two cascade paths to this table — one through the
/// submission and one through the field — which it refuses outright.
/// </item>
/// </list>
/// <para>
/// The answer belongs to its submission, and that relationship <i>is</i> a cascading foreign key.
/// </para>
/// </remarks>
public class KurdnezamFormAnswer : BaseAuditableEntity
{
    public int SubmissionId { get; set; }

    public KurdnezamFormSubmission? Submission { get; set; }

    /// <summary>The <see cref="KurdnezamFormField"/> this answers. May no longer exist.</summary>
    public int FieldId { get; set; }

    /// <summary>The field's label as it read when this was sent, so the answer survives a rename.</summary>
    public string FieldLabel { get; set; } = string.Empty;

    public string Text { get; set; } = string.Empty;
}

/// <summary>
/// A file a member attached to one file field. Only the reference is stored; the bytes live in
/// MinIO, like every other upload in this project.
/// </summary>
/// <remarks>
/// Unlike <see cref="KurdnezamNewsAttachment"/>, these are <b>not</b> served to the public. A
/// member may attach a scan of their national id card, so only an administrator may download one.
/// <see cref="StoredKey"/> is therefore an object key, not a URL — there is no public route that
/// turns it into one. <see cref="FieldId"/> and <see cref="FieldLabel"/> behave exactly as on
/// <see cref="KurdnezamFormAnswer"/>.
/// </remarks>
public class KurdnezamFormAttachment : BaseAuditableEntity
{
    public int SubmissionId { get; set; }

    public KurdnezamFormSubmission? Submission { get; set; }

    public int FieldId { get; set; }

    public string FieldLabel { get; set; } = string.Empty;

    /// <summary>The name the member's file had, used when an administrator downloads it.</summary>
    public string FileName { get; set; } = string.Empty;

    /// <summary>Object key inside the bucket. Never handed to a browser.</summary>
    public string StoredKey { get; set; } = string.Empty;

    public string ContentType { get; set; } = string.Empty;

    public long SizeBytes { get; set; }
}
