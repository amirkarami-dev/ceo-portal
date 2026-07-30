namespace Mabhas19.Infrastructure.Elections;

/// <summary>
/// Bale bot configuration. Every value here is a secret or a secret-adjacent path and lives only in
/// <c>deploy/prod.enc.env</c> (SOPS) — never in a tracked appsettings file.
/// </summary>
public sealed class BaleOptions
{
    public const string SectionName = "Bale";

    /// <summary>Bot token for <c>https://tapi.bale.ai/bot{token}/</c>. Empty disables the bot entirely.</summary>
    public string BotToken { get; init; } = string.Empty;

    /// <summary>
    /// Unguessable segment appended to the webhook route, e.g. <c>/api/BaleWebhook/{WebhookPath}</c>.
    /// </summary>
    /// <remarks>
    /// <b>This is not authentication.</b> The path is returned by <c>getWebhookInfo</c> and appears in
    /// every reverse-proxy access log line. It only keeps casual scanners out. What actually stops a
    /// leaked path from casting a vote is the fresh OTP required for every cast.
    /// </remarks>
    public string WebhookPath { get; init; } = string.Empty;

    /// <summary>
    /// Optional shared secret compared against the <c>X-Bale-Webhook-Secret</c> header.
    /// </summary>
    /// <remarks>
    /// Telegram sends <c>X-Telegram-Bot-Api-Secret-Token</c> when <c>setWebhook</c> is given
    /// <c>secret_token</c>; Bale's clone is not documented to. Left optional so the bot still works if
    /// Bale does not send it — when set, requests without a matching header are refused.
    /// </remarks>
    public string WebhookSecret { get; init; } = string.Empty;

    /// <summary>
    /// <c>api-access-key</c> for <c>safir.bale.ai</c>, used to push an OTP to a Bale account <b>by phone
    /// number</b>. Empty means the Bale channel degrades to SMS only.
    /// </summary>
    /// <remarks>
    /// This is what delivers the vote code to the person who owns the registered mobile — never into the
    /// chat that asked. See <c>VoteOtpSender</c> for why that distinction is the whole security model.
    /// </remarks>
    public string SafirAccessKey { get; init; } = string.Empty;

    /// <summary>
    /// Numeric bot id safir requires in the request body (<c>bot_id</c>).
    /// </summary>
    /// <remarks>
    /// Not the bot token and not the <c>@username</c> — a separate number shown on the safir dashboard.
    /// Required: without it safir refuses, the Bale channel reports "not delivered" and SMS silently
    /// carries every code. No default, so a missing value fails loudly at the first send rather than
    /// pointing at somebody else's bot.
    /// </remarks>
    public long SafirBotId { get; init; }

    /// <summary>How long a Bale conversation survives without a message.</summary>
    /// <remarks>
    /// Short on purpose: the session holds a کد ملی in memory, and a fresh OTP is required for every
    /// cast anyway, so there is nothing to gain from keeping it warm.
    /// </remarks>
    public int SessionIdleMinutes { get; init; } = 20;
}

/// <summary>
/// Limits for the vote OTP. Separate from the IdP's <c>Otp</c> section on purpose — a login code must
/// never be redeemable as a vote, and the two flows have different abuse shapes.
/// </summary>
public sealed class VoteOtpOptions
{
    public const string SectionName = "VoteOtp";

    public int CodeLength { get; init; } = 5;
    public int TtlSeconds { get; init; } = 180;

    /// <summary>Minimum seconds between successive code requests for the same person.</summary>
    public int ResendCooldownSeconds { get; init; } = 60;

    /// <summary>Codes per person per hour.</summary>
    public int MaxSendsPerHour { get; init; } = 6;

    /// <summary>Wrong guesses before the active code is destroyed and a lockout starts.</summary>
    public int MaxVerifyAttempts { get; init; } = 5;

    /// <summary>
    /// How long a lockout lasts. Applies per person as well as per chat, because کد ملی is public in
    /// Iran — brute-forcing identities must cost as much as brute-forcing codes.
    /// </summary>
    public int LockoutMinutes { get; init; } = 30;

    /// <summary>Development only: log the generated code. Must stay false in production.</summary>
    /// <remarks>
    /// The IdP's equivalent switch logs the phone number alongside the code. This one never logs the
    /// phone or the voter key — the registered mobile plus a timestamp is a voter-roll entry, and the
    /// application log is usually less protected than the database.
    /// </remarks>
    public bool LogCode { get; init; }
}
