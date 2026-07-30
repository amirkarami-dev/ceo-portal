using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using Mabhas19.Application.Common.Interfaces.Elections;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.Elections;

/// <summary>
/// AES-256-GCM over a fixed-length, ascending-sorted slot array.
/// </summary>
/// <remarks>
/// <para><b>Layout of the stored blob:</b> <c>nonce(12) || ciphertext(4 × maxSelections) || tag(16)</c>.</para>
/// <para>
/// Three properties matter, and each defends against a specific leak:
/// </para>
/// <list type="number">
/// <item>
/// <b>Fixed length.</b> The plaintext is always <c>4 × maxSelections</c> bytes, padded with zeros —
/// so a voter who picked one candidate out of five produces exactly the same size blob as one who
/// picked five. Variable length would publish how many people each voter chose.
/// </item>
/// <item>
/// <b>Sorted slots.</b> Selections are sorted ascending before sealing, so the order the voter
/// clicked in is destroyed. Insertion order would otherwise be a per-voter fingerprint.
/// </item>
/// <item>
/// <b>Election-bound key and AAD.</b> The key is derived per election, and the election id plus key
/// version are passed as additional authenticated data. A ballot moved to another election fails to
/// open rather than silently counting somewhere it does not belong.
/// </item>
/// </list>
/// <para>
/// The master key never encrypts anything directly — HKDF derives a distinct key per election, so
/// compromising one election's key does not open another's.
/// </para>
/// </remarks>
internal sealed class BallotSealer : IBallotSealer
{
    private const int NonceSize = 12; // AES-GCM standard
    private const int TagSize = 16;
    private const int SlotSize = sizeof(int);

    private readonly byte[] _masterKey;

    public BallotSealer(IOptions<ElectionCryptoOptions> options)
    {
        var configured = options.Value.BallotMasterKey;
        _masterKey = string.IsNullOrWhiteSpace(configured) ? [] : Convert.FromBase64String(configured);

        if (_masterKey.Length is not (0 or 32))
        {
            throw new InvalidOperationException(
                "Elections:BallotMasterKey must be base64 of exactly 32 bytes.");
        }
    }

    public bool IsConfigured => _masterKey.Length == 32;

    public byte[] Seal(int electionId, byte keyVersion, int maxSelections, IReadOnlyCollection<int> candidateIds)
    {
        EnsureConfigured();
        ValidateShape(maxSelections, candidateIds.Count);

        if (candidateIds.Count == 0)
        {
            // A blank ballot is not supported. Sealing one would create a row that counts as a vote
            // and tallies to nothing, which is indistinguishable from a bug in the tally.
            throw new ArgumentException("رأی خالی پذیرفته نمی‌شود", nameof(candidateIds));
        }

        if (candidateIds.Distinct().Count() != candidateIds.Count)
        {
            // Otherwise one voter could pick the same candidate twice and count twice.
            throw new ArgumentException("انتخاب تکراری مجاز نیست", nameof(candidateIds));
        }

        if (candidateIds.Any(id => id <= 0))
        {
            // 0 is the padding value, so it must never be a real candidate id.
            throw new ArgumentException("شناسهٔ کاندیدا نامعتبر است", nameof(candidateIds));
        }

        var plaintext = new byte[maxSelections * SlotSize];
        var sorted = candidateIds.Order().ToArray();
        for (var i = 0; i < sorted.Length; i++)
        {
            BinaryPrimitives.WriteInt32LittleEndian(plaintext.AsSpan(i * SlotSize), sorted[i]);
        }
        // Remaining slots stay zero — that is the padding that keeps the length constant.

        var blob = new byte[NonceSize + plaintext.Length + TagSize];
        var nonce = blob.AsSpan(0, NonceSize);
        var ciphertext = blob.AsSpan(NonceSize, plaintext.Length);
        var tag = blob.AsSpan(NonceSize + plaintext.Length, TagSize);

        RandomNumberGenerator.Fill(nonce);

        using var aes = new AesGcm(DeriveKey(electionId, keyVersion), TagSize);
        aes.Encrypt(nonce, plaintext, ciphertext, tag, Aad(electionId, keyVersion));

        CryptographicOperations.ZeroMemory(plaintext);
        return blob;
    }

    public int[] Open(int electionId, byte keyVersion, int maxSelections, byte[] sealedBallot)
    {
        EnsureConfigured();

        var expected = NonceSize + (maxSelections * SlotSize) + TagSize;
        if (sealedBallot.Length != expected)
        {
            throw new CryptographicException(
                $"Sealed ballot is {sealedBallot.Length} bytes; expected {expected}.");
        }

        var plaintext = new byte[maxSelections * SlotSize];

        using var aes = new AesGcm(DeriveKey(electionId, keyVersion), TagSize);

        // Throws CryptographicException on a bad tag — tampering, wrong election, wrong key version.
        // Deliberately not caught: a ballot that will not open is a real integrity failure and the
        // tally must stop rather than quietly drop a vote.
        aes.Decrypt(
            sealedBallot.AsSpan(0, NonceSize),
            sealedBallot.AsSpan(NonceSize, plaintext.Length),
            sealedBallot.AsSpan(NonceSize + plaintext.Length, TagSize),
            plaintext,
            Aad(electionId, keyVersion));

        var result = new List<int>(maxSelections);
        for (var i = 0; i < maxSelections; i++)
        {
            var id = BinaryPrimitives.ReadInt32LittleEndian(plaintext.AsSpan(i * SlotSize));
            if (id != 0)
            {
                result.Add(id);
            }
        }

        CryptographicOperations.ZeroMemory(plaintext);
        return [.. result];
    }

    /// <summary>
    /// Per-election key. The election id is the HKDF <c>info</c>, so every election gets an
    /// independent key from the same master secret.
    /// </summary>
    private byte[] DeriveKey(int electionId, byte keyVersion) =>
        HKDF.DeriveKey(
            HashAlgorithmName.SHA256,
            _masterKey,
            outputLength: 32,
            salt: null,
            info: Encoding.UTF8.GetBytes($"ceo-portal/election-ballot/v{keyVersion}/{electionId}"));

    /// <summary>
    /// Additional authenticated data. Not secret — it binds the ciphertext to its election so a blob
    /// cannot be replayed into a different one.
    /// </summary>
    private static byte[] Aad(int electionId, byte keyVersion) =>
        Encoding.UTF8.GetBytes($"election={electionId};keyVersion={keyVersion}");

    private void EnsureConfigured()
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException(
                "Elections:BallotMasterKey is not configured; voting is unavailable.");
        }
    }

    private static void ValidateShape(int maxSelections, int picked)
    {
        if (maxSelections < 1)
        {
            throw new ArgumentOutOfRangeException(nameof(maxSelections));
        }

        if (picked > maxSelections)
        {
            throw new ArgumentException(
                $"تعداد انتخاب‌ها ({picked}) از حد مجاز ({maxSelections}) بیشتر است", nameof(picked));
        }
    }
}
