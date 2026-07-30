using System.Security.Cryptography;
using System.Text;
using Mabhas19.Application.Common;
using Mabhas19.Application.Common.Interfaces.Elections;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.Elections;

/// <inheritdoc cref="IVoteOtpStore"/>
/// <remarks>
/// <para>
/// In-process memory. The API runs as a single container with no replicas, and codes live for minutes —
/// there is nothing here worth the operational weight of Redis, and a restart merely means the user asks
/// for a new code.
/// </para>
/// <para>
/// Modelled on <c>src/Auth/Otp/OtpService.cs</c>, with three deliberate differences: keys are
/// purpose-scoped so a login code can never be redeemed as a vote, every limit is applied per person
/// <b>and</b> per chat, and <b>neither the phone nor the voter key is ever logged</b>.
/// </para>
/// </remarks>
internal sealed class VoteOtpStore(
    IMemoryCache cache,
    IOptions<VoteOtpOptions> options,
    ILogger<VoteOtpStore> logger) : IVoteOtpStore
{
    private readonly VoteOtpOptions _options = options.Value;

    // "vote-otp" separates this from the IdP's "otp:{phone}", which lives in a different process and a
    // different cache; the distinct prefix documents that they must never be merged.
    //
    // Every key is scoped by CHAT, and every key except the lockout also by purpose. The chat scoping is
    // what stops کد ملی — a public number — from being usable to interfere with someone else's voting.
    private static string CodeKey(long chatId, string voter, OtpPurpose p) => $"vote-otp:{p}:code:{chatId}:{voter}";

    // Cooldown is keyed by CHAT as well as voter, deliberately. Keyed on the voter alone, anyone who
    // knows a کد ملی — a public number in Iran — could request a code from their own chat and lock the
    // real person out of requesting one for the next minute, repeatedly. The outstanding code lives
    // under the requesting chat's key, so a voter-only cooldown would also mean telling someone to
    // enter a code that was delivered to a conversation they cannot see. Volume abuse is still capped by
    // the hourly counters below, which ARE per voter.
    private static string CooldownKey(long chatId, string voter, OtpPurpose p) =>
        $"vote-otp:{p}:cooldown:{chatId}:{voter}";
    // The hourly cap per PERSON stays, and it is the one limit an attacker can still consume by typing a
    // public کد ملی: they cause SMS to that member's phone and use up the member's hourly budget. That is
    // inherent to any "type your public ID and we text you" flow — the IdP's own engineer login has the
    // same property — and the cap is what bounds the SMS bill. Residual, documented, not fixable here.
    private static string SendsKey(string voter, OtpPurpose p) => $"vote-otp:{p}:sends:{voter}";
    private static string AttemptsKey(long chatId, string voter, OtpPurpose p) => $"vote-otp:{p}:attempts:{chatId}:{voter}";
    private static string ChatSendsKey(long chatId, OtpPurpose p) => $"vote-otp:{p}:chat-sends:{chatId}";

    // Lockout is per CHAT and voter, not per voter. Keyed on the voter alone it was a weapon: کد ملی is
    // public, so anyone could type a member's number into their own chat, burn the five allowed guesses,
    // and lock that member out of the bot for the whole lockout window — repeatedly, for the length of the
    // election. Scoped to the chat, an attacker can only lock their own conversation. Brute force stays
    // bounded because the code itself is bound to (chat, voter, purpose): guesses in one chat can never
    // unlock another.
    private static string LockKey(long chatId, string voter) => $"vote-otp:lock:{chatId}:{voter}";

    public Task<OtpIssueResult> IssueAsync(
        long chatId,
        byte[] voterKey,
        OtpPurpose purpose,
        CancellationToken cancellationToken)
    {
        var voter = Fingerprint(voterKey);

        if (cache.TryGetValue(LockKey(chatId, voter), out _))
        {
            return Task.FromResult(new OtpIssueResult(
                OtpIssueOutcome.LockedOut, null, _options.LockoutMinutes * 60));
        }

        if (cache.TryGetValue(CooldownKey(chatId, voter, purpose), out _))
        {
            // Not an error: the previously sent code of THIS purpose is still valid, so the user is told
            // to enter it.
            return Task.FromResult(new OtpIssueResult(
                OtpIssueOutcome.Cooldown, null, _options.ResendCooldownSeconds));
        }

        // Two independent caps. Per person, because کد ملی is public and a caller could walk a list of
        // codes from many chats; per chat, because one chat could walk a list of کد ملی.
        var sends = cache.Get<int?>(SendsKey(voter, purpose)) ?? 0;
        var chatSends = cache.Get<int?>(ChatSendsKey(chatId, purpose)) ?? 0;

        if (sends >= _options.MaxSendsPerHour || chatSends >= _options.MaxSendsPerHour)
        {
            logger.LogWarning("Vote OTP send cap reached; request throttled.");
            return Task.FromResult(new OtpIssueResult(OtpIssueOutcome.RateLimited, null, 3600));
        }

        var code = GenerateCode(_options.CodeLength);

        cache.Set(CodeKey(chatId, voter, purpose), code, TimeSpan.FromSeconds(_options.TtlSeconds));
        cache.Remove(AttemptsKey(chatId, voter, purpose));
        cache.Set(CooldownKey(chatId, voter, purpose), 1, TimeSpan.FromSeconds(_options.ResendCooldownSeconds));
        cache.Set(SendsKey(voter, purpose), sends + 1, TimeSpan.FromHours(1));
        cache.Set(ChatSendsKey(chatId, purpose), chatSends + 1, TimeSpan.FromHours(1));

        if (_options.LogCode)
        {
            // Development only, and even then WITHOUT the voter key or the phone — the code alone is
            // useless to anyone reading the log later, but a code next to an identity is a vote.
            logger.LogInformation("Vote OTP issued: {Code}", code);
        }

        return Task.FromResult(new OtpIssueResult(OtpIssueOutcome.Issued, code, 0));
    }

    public Task<OtpVerifyOutcome> VerifyAsync(
        long chatId,
        byte[] voterKey,
        OtpPurpose purpose,
        string code,
        CancellationToken cancellationToken)
    {
        var voter = Fingerprint(voterKey);

        if (cache.TryGetValue(LockKey(chatId, voter), out _))
        {
            return Task.FromResult(OtpVerifyOutcome.LockedOut);
        }

        // Bound to the chat AND the purpose as well as the person: a code glimpsed over a shoulder must
        // not be redeemable from the onlooker's own chat, and an identity code must not cast a vote.
        if (cache.Get<string>(CodeKey(chatId, voter, purpose)) is not { } stored)
        {
            return Task.FromResult(OtpVerifyOutcome.Invalid);
        }

        var attempts = cache.Get<int?>(AttemptsKey(chatId, voter, purpose)) ?? 0;
        if (attempts >= _options.MaxVerifyAttempts)
        {
            cache.Remove(CodeKey(chatId, voter, purpose));
            cache.Set(LockKey(chatId, voter), 1, TimeSpan.FromMinutes(_options.LockoutMinutes));
            logger.LogWarning("Vote OTP attempt cap reached; code destroyed and lockout started.");
            return Task.FromResult(OtpVerifyOutcome.LockedOut);
        }

        // Persian/Arabic digits arrive from fa keyboards; the stored code is Latin.
        var supplied = JalaliDate.NormalizeDigits(code).Trim();

        var ok = supplied.Length == stored.Length
                 && CryptographicOperations.FixedTimeEquals(
                     Encoding.UTF8.GetBytes(stored),
                     Encoding.UTF8.GetBytes(supplied));

        if (ok)
        {
            // Single use. Not removing it would let a replayed webhook update cast a second time.
            cache.Remove(CodeKey(chatId, voter, purpose));
            cache.Remove(AttemptsKey(chatId, voter, purpose));

            // A spent code also clears its own cooldown, so the next purpose in the flow is not made to
            // wait behind a code that has already been used.
            cache.Remove(CooldownKey(chatId, voter, purpose));
            return Task.FromResult(OtpVerifyOutcome.Valid);
        }

        cache.Set(
            AttemptsKey(chatId, voter, purpose), attempts + 1, TimeSpan.FromSeconds(_options.TtlSeconds));
        return Task.FromResult(OtpVerifyOutcome.Invalid);
    }

    /// <summary>
    /// A short, log-safe and cache-safe label for the voter key.
    /// </summary>
    /// <remarks>
    /// The key handed in is already a 32-byte HMAC of the کد ملی. Only the first 8 bytes are used as a
    /// cache key so nothing that could be brute-forced back into a کد ملی sits in a string, while the
    /// collision chance across a few thousand voters stays negligible.
    /// </remarks>
    private static string Fingerprint(byte[] voterKey) =>
        Convert.ToHexString(voterKey.AsSpan(0, Math.Min(8, voterKey.Length)));

    private static string GenerateCode(int length)
    {
        var max = (int)Math.Pow(10, length);
        return RandomNumberGenerator.GetInt32(0, max).ToString().PadLeft(length, '0');
    }
}
