using System.Security.Cryptography;
using System.Text;
using Mabhas19.Application.Common;
using Mabhas19.Application.Common.Interfaces.Elections;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.Elections;

/// <inheritdoc cref="IVoterRoll"/>
internal sealed class VoterRoll : IVoterRoll
{
    private readonly byte[] _pepper;

    public VoterRoll(IOptions<ElectionCryptoOptions> options)
    {
        var configured = options.Value.VoterPepper;
        _pepper = string.IsNullOrWhiteSpace(configured) ? [] : Convert.FromBase64String(configured);

        // A short pepper is worse than none: it looks configured but is guessable. Fail loudly at
        // startup rather than quietly producing weak roll entries for a real election.
        if (_pepper.Length is not (0 or 32))
        {
            throw new InvalidOperationException(
                "Elections:VoterPepper must be base64 of exactly 32 bytes.");
        }
    }

    public bool IsConfigured => _pepper.Length == 32;

    public byte[] ComputeHash(int electionId, string nationalCode)
    {
        if (!IsConfigured)
        {
            throw new InvalidOperationException(
                "Elections:VoterPepper is not configured; voting is unavailable.");
        }

        var code = Normalise(nationalCode);

        // The scope prefix is what stops one person's hash being the same across elections. Without
        // it, anyone holding the pepper could follow a voter's whole history.
        var material = $"{electionId}:{code}";

        return HMACSHA256.HashData(_pepper, Encoding.UTF8.GetBytes(material));
    }

    /// <summary>
    /// The کد ملی exactly as it must be hashed: Persian/Arabic digits folded to Latin, trimmed, and
    /// asserted to be 10 digits.
    /// </summary>
    /// <remarks>
    /// This normalisation is load-bearing, not cosmetic. The same person can arrive as
    /// <c>"۱۲۳۴۵۶۷۸۹۰"</c> from a Persian keyboard on the bot and <c>"1234567890"</c> from the web. If
    /// those produced different hashes, the UNIQUE key on the roll would not fire and they would vote
    /// twice. A leading-zero code like <c>"0012345678"</c> must also survive untouched, which is why
    /// this stays a string and is never parsed as a number.
    /// </remarks>
    internal static string Normalise(string nationalCode)
    {
        if (string.IsNullOrWhiteSpace(nationalCode))
        {
            throw new ArgumentException("کد ملی خالی است", nameof(nationalCode));
        }

        var code = JalaliDate.NormalizeDigits(nationalCode).Trim();

        if (code.Length != 10 || !code.All(char.IsAsciiDigit))
        {
            throw new ArgumentException("کد ملی باید ۱۰ رقم باشد", nameof(nationalCode));
        }

        return code;
    }
}
