namespace Mabhas19.Application.Kurdnezam.Forms;

/// <summary>A registration form as served to the public site and the admin panel.</summary>
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

    public int SortOrder { get; init; }

    /// <summary>Denormalised so the admin list can show the backlog without a second call.</summary>
    public int SubmissionCount { get; init; }
}

/// <summary>A member's submission. Admin-only — it carries personal data.</summary>
public sealed class KurdnezamFormSubmissionDto
{
    public int Id { get; init; }

    public int FormId { get; init; }

    /// <summary>Denormalised so the admin table can render the form name without a second call.</summary>
    public string? FormTitle { get; init; }

    public string FullName { get; init; } = string.Empty;

    public string NationalId { get; init; } = string.Empty;

    public string MembershipNo { get; init; } = string.Empty;

    public string Mobile { get; init; } = string.Empty;

    public string? Notes { get; init; }

    public bool IsHandled { get; init; }

    public DateTimeOffset Created { get; init; }
}
