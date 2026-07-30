namespace Mabhas19.Application.Common.Interfaces.Elections;

/// <summary>Which channels actually accepted the code.</summary>
/// <remarks>
/// Both are attempted every time. If one fails the other still counts as delivered, and the user is told
/// which one worked — otherwise someone whose Bale push failed would sit waiting for a message that is
/// already in their SMS inbox.
/// </remarks>
public sealed record OtpDelivery(bool ViaBale, bool ViaSms)
{
    public bool AnyDelivered => ViaBale || ViaSms;
}

/// <summary>Sends a vote code to the mobile the organisation has on record.</summary>
/// <remarks>
/// <b>There is deliberately no chat id here.</b> An earlier version delivered the code as a message into
/// the Bale conversation that had just typed the کد ملی, which made a <i>public</i> number the only factor
/// needed to vote as somebody else: open your own chat, type any member's کد ملی, read the code off your
/// own screen, and cast their ballot — permanently, because the roll's UNIQUE key then treats the real
/// member as having already voted. Both delivery channels must be bound to the registered
/// <paramref name="phone"/>, so the parameter that made the mistake possible is gone.
/// </remarks>
public interface IVoteOtpSender
{
    Task<OtpDelivery> SendAsync(string phone, string code, CancellationToken cancellationToken);
}

/// <summary>What a code authorises. Codes of one purpose are never redeemable for the other.</summary>
/// <remarks>
/// <para>
/// The two flows sit back to back — someone identifies and then immediately submits a selection — so they
/// need <b>independent</b> cooldowns and send counters. Sharing them means the vote code is refused for a
/// minute after the identity code, and the voter is told to enter a code that was never sent: a dead end
/// in the middle of a voting window.
/// </para>
/// <para>
/// Separating them at <i>verify</i> time matters more. If an identity code could be redeemed as a vote
/// code, one captured code would both identify and cast — which is the same class of mistake as sharing a
/// store with the IdP's login OTP, only inside this service.
/// </para>
/// </remarks>
public enum OtpPurpose
{
    /// <summary>Proves the کد ملی belongs to whoever holds the registered mobile.</summary>
    Identity = 0,

    /// <summary>Authorises one specific cast. Always freshly issued.</summary>
    Vote = 1
}

/// <summary>Why an OTP request did not produce a new code.</summary>
public enum OtpIssueOutcome
{
    Issued = 0,

    /// <summary>A code was sent very recently; the existing one is still valid.</summary>
    Cooldown,

    /// <summary>The hourly cap for this person or chat is used up.</summary>
    RateLimited,

    /// <summary>Too many failures; locked out for a while.</summary>
    LockedOut
}

public sealed record OtpIssueResult(OtpIssueOutcome Outcome, string? Code, int RetryAfterSeconds)
{
    public bool IsIssued => Outcome == OtpIssueOutcome.Issued && Code is not null;
}

public enum OtpVerifyOutcome
{
    Valid = 0,

    /// <summary>Wrong code, or no code outstanding, or it expired.</summary>
    Invalid,

    /// <summary>Too many wrong guesses; the code was destroyed and the requester is locked out.</summary>
    LockedOut
}

/// <summary>
/// One-time codes that authorise a <b>vote</b>, kept entirely separate from the IdP's login OTP.
/// </summary>
/// <remarks>
/// <para>
/// <b>Separate from login on purpose.</b> Sharing a store — or even a key format — with the IdP would
/// make a login code redeemable as a vote, so a phishing page that harvested one login code could cast a
/// ballot. Keys here are purpose-scoped and the message wording differs («کد تأیید رأی‌گیری»).
/// </para>
/// <para>
/// <b>Bound to the chat AND the person.</b> A code issued for one Bale chat must not verify in another,
/// or someone who saw the code over a shoulder could redeem it from their own chat. And کد ملی is
/// public, so brute-forcing identities has to be as expensive as brute-forcing codes: the limits apply
/// per person as well as per chat.
/// </para>
/// <para>
/// <b>Never log the phone or the code.</b> The registered mobile plus a timestamp is a voter-roll entry
/// in the application log, which is usually less protected than the database. The voter key passed here
/// is already a hash.
/// </para>
/// </remarks>
public interface IVoteOtpStore
{
    /// <param name="voterKey">A stable per-person hash — never the کد ملی itself.</param>
    Task<OtpIssueResult> IssueAsync(
        long chatId,
        byte[] voterKey,
        OtpPurpose purpose,
        CancellationToken cancellationToken);

    Task<OtpVerifyOutcome> VerifyAsync(
        long chatId,
        byte[] voterKey,
        OtpPurpose purpose,
        string code,
        CancellationToken cancellationToken);
}
