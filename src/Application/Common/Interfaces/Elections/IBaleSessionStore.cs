namespace Mabhas19.Application.Common.Interfaces.Elections;

/// <summary>Where a Bale conversation has got to.</summary>
public enum BaleStage
{
    /// <summary>Fresh chat, or reset. Waiting for a کد ملی.</summary>
    AwaitingNationalCode = 0,

    /// <summary>A code was typed and an OTP sent; waiting for the OTP that proves it is theirs.</summary>
    AwaitingIdentityOtp,

    /// <summary>Identity established. Browsing elections and choosing candidates.</summary>
    Ready,

    /// <summary>A selection is complete and a fresh OTP was sent to authorise the cast.</summary>
    AwaitingVoteOtp
}

/// <summary>
/// One Bale conversation in progress.
/// </summary>
/// <remarks>
/// This object holds a کد ملی in <b>memory only</b>. See <see cref="IBaleSessionStore"/> for why it is
/// never persisted.
/// </remarks>
public sealed class BaleSession
{
    public long ChatId { get; init; }

    public BaleStage Stage { get; set; } = BaleStage.AwaitingNationalCode;

    /// <summary>Typed but not yet proven by OTP. Must never be used to cast.</summary>
    public string? PendingNationalCode { get; set; }

    /// <summary>OTP-verified identity. This is what a cast is keyed on.</summary>
    public string? NationalCode { get; set; }

    /// <summary>The registered mobile from the org record, for resends. Never shown in full.</summary>
    public string? Phone { get; set; }

    public int? PendingElectionId { get; set; }

    public List<int> PendingChoices { get; } = [];

    /// <summary>
    /// True only past the identity OTP. Checked before anything that reveals or changes a vote, so a
    /// stale button tap from an expired session cannot act on someone's behalf.
    /// </summary>
    /// <remarks>
    /// Parenthesised deliberately. Without the brackets this reads as though the <c>&amp;&amp;</c> might
    /// bind only to the second pattern — it does not, but a security check that has to be reasoned about
    /// twice is a check waiting to be edited wrongly.
    /// </remarks>
    public bool IsIdentified =>
        (Stage is BaleStage.Ready or BaleStage.AwaitingVoteOtp)
        && !string.IsNullOrEmpty(NationalCode);

    public void ResetSelection()
    {
        PendingElectionId = null;
        PendingChoices.Clear();
    }
}

/// <summary>
/// Short-lived conversation state for the Bale bot.
/// </summary>
/// <remarks>
/// <para>
/// <b>Deliberately not a database table.</b> The design sketched a <c>BaleChatSession</c> entity; its own
/// adversarial review then found that table to be the second-worst finding — "every Bale voter
/// identifiable with SQL read alone" — and patched it by storing only the <c>VoterHash</c>. But a hash
/// cannot be reversed, and a cast needs the کد ملی to check eligibility against the org directory and to
/// compute the per-election roll hash. So the patched table could not actually work, and an unpatched one
/// is a named voter list sitting next to the ballots.
/// </para>
/// <para>
/// Keeping the state in process memory removes the problem instead of mitigating it: <b>nothing about a
/// voter's identity ever reaches disk</b>, and no new secret is needed to protect a reversible copy. The
/// API runs as a single container with no replicas, so there is nowhere else the state needs to be.
/// </para>
/// <para>
/// The cost is that a deploy or restart drops conversations in progress and the person has to
/// <c>/start</c> again. No vote is ever lost — the receipt and the ballot are committed in the database —
/// and the design already requires a fresh OTP per cast, so there is no long-lived session to preserve.
/// </para>
/// <para>
/// If the API is ever scaled past one replica this becomes wrong, not merely inefficient: an update
/// routed to another instance would look like a brand-new chat. Sticky sessions or a shared store would
/// be required, and the shared store must then encrypt the کد ملی at rest.
/// </para>
/// </remarks>
public interface IBaleSessionStore
{
    /// <summary>The current session, or a fresh one at <see cref="BaleStage.AwaitingNationalCode"/>.</summary>
    Task<BaleSession> GetAsync(long chatId, CancellationToken cancellationToken);

    /// <summary>Stores the session and renews its inactivity window.</summary>
    Task SaveAsync(BaleSession session, CancellationToken cancellationToken);

    /// <summary>Forgets everything about this chat, including the کد ملی.</summary>
    Task ClearAsync(long chatId, CancellationToken cancellationToken);
}
