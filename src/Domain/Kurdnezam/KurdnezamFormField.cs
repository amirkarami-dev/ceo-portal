using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Kurdnezam;

/// <summary>
/// One field an administrator added to a <see cref="KurdnezamForm"/>. The public form is drawn
/// entirely from these rows — nothing about a form's shape is fixed in code.
/// </summary>
public class KurdnezamFormField : BaseAuditableEntity
{
    public int FormId { get; set; }

    public KurdnezamForm? Form { get; set; }

    /// <summary>What the member reads above the input, e.g. «نام و نام خانوادگی».</summary>
    public string Label { get; set; } = string.Empty;

    /// <summary>A <see cref="KurdnezamFormFieldKinds"/> value.</summary>
    public string Kind { get; set; } = KurdnezamFormFieldKinds.Text;

    public bool IsRequired { get; set; }

    /// <summary>Read only when <see cref="Kind"/> is <c>file</c>: may the member attach several.</summary>
    public bool AllowMultiple { get; set; }

    /// <summary>Read only when <see cref="Kind"/> is <c>text</c>. Null means the column limit.</summary>
    public int? MaxLength { get; set; }

    /// <summary>Small grey line under the input, e.g. «فقط PDF».</summary>
    public string? Help { get; set; }

    public int SortOrder { get; set; }
}

/// <summary>
/// The kinds of field a form may hold. Two for now — a text box and a file — because that is what
/// was asked for.
/// </summary>
/// <remarks>
/// Strings, not a C# enum, and on purpose: this API serialises enums as <b>numbers</b>, so an enum
/// would put "1" in the admin dropdown and in the JSON. Same reasoning as
/// <see cref="KurdnezamContactChannelKinds"/> — see GOTCHAS.
/// <para>
/// Adding a kind later (date, number, dropdown) is one constant here, one line in the CHECK
/// constraint, and one input in the public component.
/// </para>
/// </remarks>
public static class KurdnezamFormFieldKinds
{
    /// <summary>A single-line text box.</summary>
    public const string Text = "text";

    /// <summary>One file, or several when <see cref="KurdnezamFormField.AllowMultiple"/> is set.</summary>
    public const string File = "file";

    public static readonly string[] All = [Text, File];

    public static bool IsValid(string? kind) => kind is not null && All.Contains(kind);
}
