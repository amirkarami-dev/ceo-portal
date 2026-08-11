namespace Mabhas19.Application.Kurdnezam.Forms;

/// <summary>One field of a form, as the public site and the panel see it.</summary>
public sealed class KurdnezamFormFieldDto
{
    public int Id { get; init; }

    public string Label { get; init; } = string.Empty;

    /// <summary>A <c>KurdnezamFormFieldKinds</c> value: <c>text</c> or <c>file</c>.</summary>
    public string Kind { get; init; } = string.Empty;

    public bool IsRequired { get; init; }

    public bool AllowMultiple { get; init; }

    public int? MaxLength { get; init; }

    public string? Help { get; init; }

    public int SortOrder { get; init; }
}

/// <summary>A form and the fields it is made of.</summary>
public sealed class KurdnezamFormDto
{
    public int Id { get; init; }

    public string Title { get; init; } = string.Empty;

    public string Note { get; init; } = string.Empty;

    /// <summary>Deadline as displayed, e.g. <c>۲۵ خرداد ۱۴۰۵</c>.</summary>
    public string Deadline { get; init; } = string.Empty;

    public string Image { get; init; } = string.Empty;

    /// <summary>When false the form is listed but closed to new submissions.</summary>
    public bool IsOpen { get; init; }

    /// <summary>Shown after a good save. Empty means the site uses its own wording.</summary>
    public string SuccessMessage { get; init; } = string.Empty;

    public int SortOrder { get; init; }

    /// <summary>Denormalised so the admin list can show the backlog without a second call.</summary>
    public int SubmissionCount { get; init; }

    public IReadOnlyList<KurdnezamFormFieldDto> Fields { get; init; } = [];
}

/// <summary>What a member typed into one field.</summary>
public sealed class KurdnezamFormAnswerDto
{
    public int FieldId { get; init; }

    /// <summary>The label as it read when this was sent — the field may since be gone.</summary>
    public string FieldLabel { get; init; } = string.Empty;

    public string Text { get; init; } = string.Empty;
}

/// <summary>
/// A file a member attached. There is no URL here on purpose: attachments are downloaded through
/// the admin-only route, never linked publicly.
/// </summary>
public sealed class KurdnezamFormAttachmentDto
{
    public int Id { get; init; }

    public int FieldId { get; init; }

    public string FieldLabel { get; init; } = string.Empty;

    public string FileName { get; init; } = string.Empty;

    public string ContentType { get; init; } = string.Empty;

    public long SizeBytes { get; init; }
}

/// <summary>A member's submission. Admin-only — it carries personal data.</summary>
public sealed class KurdnezamFormSubmissionDto
{
    public int Id { get; init; }

    public int FormId { get; init; }

    /// <summary>Denormalised so the admin table can render the form name without a second call.</summary>
    public string? FormTitle { get; init; }

    public bool IsHandled { get; init; }

    public DateTimeOffset Created { get; init; }

    public IReadOnlyList<KurdnezamFormAnswerDto> Answers { get; init; } = [];

    public IReadOnlyList<KurdnezamFormAttachmentDto> Attachments { get; init; } = [];
}
