namespace Mabhas19.Domain.Elections;

/// <summary>
/// One discipline allowed to vote in an election. Only consulted when the election's
/// <see cref="ElectionEligibility.ByReshte"/> mode is set.
/// </summary>
/// <remarks>
/// <para>
/// <see cref="ReshteCode"/> is an <b>opaque string</b>, compared against the <c>Reshte</c> column of
/// <c>WebS_GetEngineerInfo</c> — the org's 1–7 discipline code (1 معماری … 7 ترافیک), per its own data
/// dictionary. There is deliberately no enum and no lookup table: the org's real code list is not this
/// repo's to own, and the client's discipline names do not match it. Adding a discipline is an admin
/// typing a code — never a code change.
/// </para>
/// <para>
/// <b>Not <c>ReshteID</c>.</b> That column is a رشته-گرایش id — a live row carries <c>3000</c> beside
/// <c>ReshteNam = عمران-عمران</c> — and matches none of the seven codes. The directory read it for a
/// while, which would have refused every voter in a discipline-restricted election.
/// </para>
/// <para>
/// Deliberately NOT a <c>BaseEntity</c>. A surrogate <c>Id</c> would buy nothing here and the natural
/// key <c>(ElectionId, ReshteCode)</c> already prevents the same discipline being added twice.
/// </para>
/// </remarks>
public class ElectionEligibleReshte
{
    public int ElectionId { get; set; }

    public Election? Election { get; set; }

    /// <summary>Opaque discipline code, e.g. <c>"4"</c> for مکانیک.</summary>
    public string ReshteCode { get; set; } = string.Empty;

    /// <summary>
    /// What the admin saw when they picked the code, e.g. «مکانیک». Display only — eligibility never
    /// reads this, so a wrong or missing label can never change who may vote.
    /// </summary>
    public string? ReshteLabel { get; set; }
}
