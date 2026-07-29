namespace Mabhas19.Domain.Elections;

/// <summary>
/// Proof that <b>someone</b> voted — without recording who.
/// </summary>
/// <remarks>
/// <para>
/// This is one half of the secret ballot. It holds a keyed hash of the voter's کد ملی and nothing
/// else. The pepper lives only in <c>deploy/.env</c>, never in the database, so a reader of CeoDb
/// cannot even confirm that a <i>named</i> person voted.
/// </para>
/// <para>
/// <b>Every omission here is deliberate. Do not "improve" this class.</b>
/// </para>
/// <list type="bullet">
/// <item><b>Derives nothing.</b> Not <c>BaseAuditableEntity</c> — that interceptor would stamp
/// <c>CreatedBy</c> with the voter's OIDC subject, which is the exact link this table exists to
/// prevent. Not <c>BaseEntity</c> either: an identity <c>Id</c> would order rows by insert time.</item>
/// <item><b>No timestamp of any kind.</b> A timestamp beside a ballot timestamp is a join key.</item>
/// <item><b>No channel column.</b> Knowing a vote came via بله narrows the cohort for nothing.</item>
/// <item><b>No confirmation code.</b> A stored receipt is worse than useless — a coerced voter's code
/// plus database access locates their row.</item>
/// <item><b>No pepper version.</b> Rotation is impossible while an election is open anyway.</item>
/// </list>
/// <para>
/// The UNIQUE key on <c>(ElectionId, VoterHash)</c> is what makes double voting impossible — enforced
/// by the database, on both the web and the bot, not by application logic that could be raced.
/// </para>
/// <para>
/// This table is <b>never purged</b>. The rows carry no choice, so turnout stays provable forever and
/// the 30-day ballot purge does not weaken the one-vote guarantee.
/// </para>
/// </remarks>
public class ElectionVoteReceipt
{
    public int ElectionId { get; set; }

    /// <summary>
    /// <c>HMAC-SHA256(pepper, "{ElectionId}:{nationalCode}")</c>.
    /// <para>
    /// The کد ملی must be hashed exactly as <c>EngineerInfo.NationalCode</c> returns it — trimmed and
    /// asserted to be 10 ASCII digits. Never the token string and never the bot's stored copy: one
    /// Persian-digit or leading-zero difference produces a different hash, and the same person votes
    /// twice.
    /// </para>
    /// <para>
    /// Scoped per election on purpose. A global hash of a کد ملی would let anyone holding the pepper
    /// correlate one person across every election they ever voted in.
    /// </para>
    /// </summary>
    public byte[] VoterHash { get; set; } = [];
}
