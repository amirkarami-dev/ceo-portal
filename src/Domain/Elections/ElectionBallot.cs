namespace Mabhas19.Domain.Elections;

/// <summary>
/// One cast ballot: the choice, sealed. The other half of the secret ballot.
/// </summary>
/// <remarks>
/// <para>
/// <see cref="Sealed"/> is AES-256-GCM over a fixed-length, ascending-sorted array of candidate
/// slots. The key is derived per election (HKDF) from a master key held only in <c>deploy/.env</c> —
/// never in the database. So an attacker with full read access to CeoDb holds ciphertext and nothing
/// more.
/// </para>
/// <para>
/// Fixed length and sorted slots matter: variable length would leak how many candidates a voter
/// picked, and insertion order would leak which ones.
/// </para>
/// <para>
/// <b>This table shares no column with <see cref="ElectionVoteReceipt"/>.</b> No voter reference, no
/// timestamp, no identity int PK. <see cref="BallotId"/> is a random v4 GUID and is the clustered key
/// so physical row order does not follow insert order — with an identity int, sorting by primary key
/// would reproduce the order people voted in.
/// </para>
/// <para>
/// <b>Honest limit:</b> the receipt and the ballot are written in the same transaction — they must be,
/// or you either lose votes or allow double voting. So an attacker holding the database <i>and</i> the
/// host can pair them through the SQL transaction log. Database access alone is not enough; both
/// secrets are. This is documented rather than hidden, and it is why the ballots are purged after 30
/// days: after that there is nothing left to open.
/// </para>
/// </remarks>
public class ElectionBallot
{
    /// <summary>Random v4 GUID, generated in the app — not a sequential or DB-generated value.</summary>
    public Guid BallotId { get; set; }

    public int ElectionId { get; set; }

    /// <summary>The sealed choice. Opened only by the tally, in memory, never stored decrypted.</summary>
    public byte[] Sealed { get; set; } = [];

    /// <summary>Which key version sealed this ballot, so a rotation can still open old ballots.</summary>
    public byte KeyVersion { get; set; } = 1;
}
