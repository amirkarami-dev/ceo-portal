using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Elections;

/// <summary>Who may vote in an election.</summary>
public enum ElectionEligibility
{
    /// <summary>Any کد ملی the org's membership directory knows.</summary>
    AllMembers = 0,

    /// <summary>Only the disciplines listed in <see cref="Election.EligibleReshtes"/>.</summary>
    ByReshte = 1
}

public enum ElectionStatus
{
    /// <summary>Being written. Freely editable, not visible to voters.</summary>
    Draft = 0,

    /// <summary>Visible to voters. Frozen — see the freeze rule below.</summary>
    Published = 1,

    Cancelled = 2
}

/// <summary>
/// Where an election is in its life. **Derived, never stored** — there is no scheduler and no job
/// flipping a column, so a restart or a missed tick can never leave an election stuck open.
/// </summary>
public enum ElectionPhase
{
    Draft,
    Cancelled,
    NotYetOpen,
    Open,
    Closed,
    ResultsAvailable
}

/// <summary>
/// One election, e.g. «انتخاب هیئت رئیسه واحد گاز».
/// </summary>
/// <remarks>
/// <para>
/// <see cref="Title"/> is free text and is NEVER parsed. It restricts nobody — «واحد گاز» in a title
/// does not limit voters to مکانیک; only <see cref="EligibleReshtes"/> does. The admin UI has to make
/// that obvious, or an admin will assume the title is doing work it is not.
/// </para>
/// <para>
/// <b>Freeze rule:</b> once <see cref="OpensAtUtc"/> has passed, or any ballot exists, nothing about
/// the election or its candidates may change — window, eligibility, MaxSelections, candidate list,
/// candidate names. Otherwise the meaning of already-sealed ballots changes underneath them, which
/// is a way to rig a running election.
/// </para>
/// </remarks>
public class Election : BaseAuditableEntity
{
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }

    public ElectionEligibility EligibilityMode { get; set; } = ElectionEligibility.AllMembers;

    /// <summary>تاریخ برگزاری exactly as the admin typed it, e.g. <c>1405/05/01</c>.</summary>
    public string DateJalali { get; set; } = string.Empty;

    /// <summary>Gregorian shadow of <see cref="DateJalali"/>, for querying and ordering.</summary>
    public DateOnly Date { get; set; }

    /// <summary>از ساعت.</summary>
    public TimeOnly StartTime { get; set; }

    /// <summary>تا ساعت.</summary>
    public TimeOnly EndTime { get; set; }

    /// <summary>
    /// <see cref="Date"/> + <see cref="StartTime"/> resolved to UTC at save time, at Iran's fixed
    /// +03:30. Voting windows are compared against this, never against the local parts.
    /// </summary>
    public DateTimeOffset OpensAtUtc { get; set; }

    /// <summary>Exclusive upper bound: a ballot at exactly this instant is too late.</summary>
    public DateTimeOffset ClosesAtUtc { get; set; }

    /// <summary>
    /// How many candidates one voter may pick. <c>1</c> = «فقط یک نفر»; more = «انتخاب چند نفر».
    /// There is deliberately no minimum — blank ballots are not supported, so it is always 1.
    /// </summary>
    public int MaxSelections { get; set; } = 1;

    public ElectionStatus Status { get; set; } = ElectionStatus.Draft;

    /// <summary>Set once the tally has run. Null means results do not exist yet.</summary>
    public DateTimeOffset? TalliedAt { get; set; }

    /// <summary>
    /// Digest over the sealed ballots as they stood at close. This is what proves the published
    /// numbers came from those ballots — so it must survive the 30-day ballot purge untouched.
    /// </summary>
    public byte[]? ResultDigest { get; set; }

    /// <summary>Which ballot-key version sealed this election's ballots.</summary>
    public byte KeyVersion { get; set; } = 1;

    /// <summary>
    /// Set when the sealed ballots have been purged (30 days after close). After this the result can
    /// never be re-checked, so the UI must say so before publishing.
    /// </summary>
    public DateTimeOffset? BallotsPurgedAt { get; set; }

    public ICollection<ElectionCandidate> Candidates { get; set; } = new List<ElectionCandidate>();

    public ICollection<ElectionEligibleReshte> EligibleReshtes { get; set; } = new List<ElectionEligibleReshte>();

    /// <summary>
    /// Where this election is right now. Pass the current instant in — callers use the injected
    /// <c>TimeProvider</c> so this stays testable and nothing reads the clock directly.
    /// </summary>
    public ElectionPhase PhaseAt(DateTimeOffset now) => Status switch
    {
        ElectionStatus.Cancelled => ElectionPhase.Cancelled,
        ElectionStatus.Draft     => ElectionPhase.Draft,
        _ when now < OpensAtUtc  => ElectionPhase.NotYetOpen,
        _ when now < ClosesAtUtc => ElectionPhase.Open,
        _ when TalliedAt is null => ElectionPhase.Closed,
        _                        => ElectionPhase.ResultsAvailable
    };

    /// <summary>
    /// True once the election must stop changing. Checked with <c>anyBallots</c> as well as the clock
    /// because a ballot could exist before <see cref="OpensAtUtc"/> only through a bug — and if that
    /// happens, editing is still the wrong thing to allow.
    /// </summary>
    public bool IsFrozen(DateTimeOffset now, bool anyBallots) =>
        Status != ElectionStatus.Draft && (now >= OpensAtUtc || anyBallots);
}
