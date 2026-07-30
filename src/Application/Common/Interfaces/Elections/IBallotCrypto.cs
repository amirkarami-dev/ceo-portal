namespace Mabhas19.Application.Common.Interfaces.Elections;

/// <summary>
/// Turns a کد ملی into the opaque roll entry that records "this person voted" without saying who.
/// </summary>
public interface IVoterRoll
{
    /// <summary>
    /// <c>HMAC-SHA256(pepper, "{electionId}:{nationalCode}")</c> — 32 bytes.
    /// </summary>
    /// <remarks>
    /// Scoped per election on purpose: a global hash would let anyone holding the pepper correlate one
    /// person across every election they ever voted in.
    /// </remarks>
    /// <exception cref="ArgumentException">
    /// The national code is not 10 digits. Thrown rather than hashed anyway — a malformed code would
    /// produce a hash that does not match the same person's real one, letting them vote twice.
    /// </exception>
    byte[] ComputeHash(int electionId, string nationalCode);

    /// <summary>False when no pepper is configured, which makes voting unavailable rather than unsafe.</summary>
    bool IsConfigured { get; }
}

/// <summary>
/// Seals and opens a ballot. The only code allowed to see a decrypted choice.
/// </summary>
public interface IBallotSealer
{
    /// <summary>
    /// Encrypts the chosen candidate ids. Output length depends only on <paramref name="maxSelections"/>
    /// — never on how many were actually picked — so ciphertext size leaks nothing.
    /// </summary>
    byte[] Seal(int electionId, byte keyVersion, int maxSelections, IReadOnlyCollection<int> candidateIds);

    /// <summary>
    /// Opens a ballot. Used only by the tally.
    /// </summary>
    /// <exception cref="System.Security.Cryptography.CryptographicException">
    /// The ballot was tampered with, or belongs to a different election, or the key version is wrong.
    /// GCM authenticates, so this is a real integrity failure and must never be swallowed.
    /// </exception>
    int[] Open(int electionId, byte keyVersion, int maxSelections, byte[] sealedBallot);

    /// <summary>False when no master key is configured.</summary>
    bool IsConfigured { get; }
}
