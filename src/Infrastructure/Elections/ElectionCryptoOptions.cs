namespace Mabhas19.Infrastructure.Elections;

/// <summary>
/// The two secrets the secret ballot rests on. Both come from <c>deploy/.env</c> (committed encrypted
/// as <c>deploy/prod.enc.env</c> via SOPS) and must NEVER appear in the repo or in the database.
/// </summary>
/// <remarks>
/// <para>
/// They are separate keys on purpose. The pepper protects "who voted"; the master key protects "what
/// was voted". One leaking must not reveal the other half — that separation is the whole design.
/// </para>
/// <para>
/// Both are base64 of 32 random bytes, e.g. from
/// <c>openssl rand -base64 32</c>.
/// </para>
/// <para>
/// If either is missing, elections stay readable but voting is refused. That is deliberate: running
/// an election with a default or empty key would silently produce ballots that anyone could open.
/// </para>
/// </remarks>
public sealed class ElectionCryptoOptions
{
    public const string SectionName = "Elections";

    /// <summary>Base64, 32 bytes. HMAC key for the voter roll. Config key <c>Elections:VoterPepper</c>.</summary>
    public string VoterPepper { get; init; } = string.Empty;

    /// <summary>Base64, 32 bytes. Root of the per-election ballot keys. Config key <c>Elections:BallotMasterKey</c>.</summary>
    public string BallotMasterKey { get; init; } = string.Empty;

    /// <summary>
    /// How long sealed ballots are kept after an election closes. After this they are purged and the
    /// result can never be re-checked. 30 days by default — long enough for a real dispute, after
    /// which the ballots are only a liability.
    /// </summary>
    public int BallotRetentionDays { get; init; } = 30;
}
