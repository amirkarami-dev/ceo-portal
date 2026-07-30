using Mabhas19.Application.Common.Interfaces.Elections;

namespace Mabhas19.Application.FunctionalTests.Infrastructure;

/// <summary>One message the bot sent, so a test can assert on what the user would have seen.</summary>
public sealed record SentMessage(long ChatId, string Text, BaleKeyboard? Keyboard)
{
    /// <summary>Every button's callback data, flattened — what a tap would send back.</summary>
    public IReadOnlyList<string> CallbackData =>
        Keyboard?.Rows.SelectMany(r => r).Select(b => b.CallbackData).ToList() ?? [];

    public IReadOnlyList<string> ButtonLabels =>
        Keyboard?.Rows.SelectMany(r => r).Select(b => b.Text).ToList() ?? [];
}

/// <summary>
/// Captures what the bot would have sent to Bale.
/// </summary>
/// <remarks>
/// Nothing may reach the real API from a test: it needs a live bot token, it would message real people,
/// and a rate limit on their side would make the suite flaky.
/// </remarks>
public sealed class FakeBaleClient : IBaleClient
{
    private readonly List<SentMessage> _sent = [];

    public bool IsConfigured { get; set; } = true;

    /// <summary>Set to simulate a chat the bot cannot reach (blocked bot, stale chat id).</summary>
    public bool FailSends { get; set; }

    public IReadOnlyList<SentMessage> Sent => _sent;

    public SentMessage? Last => _sent.Count > 0 ? _sent[^1] : null;

    /// <summary>The most recent message carrying buttons — usually the ballot or the election list.</summary>
    public SentMessage? LastWithKeyboard => _sent.LastOrDefault(m => m.Keyboard is not null);

    public void Reset()
    {
        _sent.Clear();
        IsConfigured = true;
        FailSends = false;
    }

    public Task<bool> SendMessageAsync(
        long chatId,
        string text,
        BaleKeyboard? keyboard = null,
        CancellationToken cancellationToken = default)
    {
        if (FailSends)
        {
            return Task.FromResult(false);
        }

        _sent.Add(new SentMessage(chatId, text, keyboard));
        return Task.FromResult(true);
    }

    public Task AnswerCallbackAsync(
        string callbackQueryId,
        string? text = null,
        CancellationToken cancellationToken = default) => Task.CompletedTask;
}

/// <summary>
/// Captures the OTP codes the bot issues, so a test can enter the right one.
/// </summary>
/// <remarks>
/// The real store generates a cryptographically random code and never exposes it — correct in
/// production, untestable here. This wraps the real limits with a recorder rather than reimplementing
/// them, so the cooldown and lockout behaviour under test is the behaviour that ships.
/// </remarks>
public sealed class RecordingVoteOtpStore(IVoteOtpStore inner) : IVoteOtpStore
{
    private readonly List<string> _codes = [];

    /// <summary>Every code issued, oldest first.</summary>
    public IReadOnlyList<string> Codes => _codes;

    public string? LastCode => _codes.Count > 0 ? _codes[^1] : null;

    public int IssueCount => _codes.Count;

    public void Reset() => _codes.Clear();

    public async Task<OtpIssueResult> IssueAsync(
        long chatId,
        byte[] voterKey,
        OtpPurpose purpose,
        CancellationToken cancellationToken)
    {
        var result = await inner.IssueAsync(chatId, voterKey, purpose, cancellationToken);

        if (result.Code is not null)
        {
            _codes.Add(result.Code);
        }

        return result;
    }

    public Task<OtpVerifyOutcome> VerifyAsync(
        long chatId,
        byte[] voterKey,
        OtpPurpose purpose,
        string code,
        CancellationToken cancellationToken)
        => inner.VerifyAsync(chatId, voterKey, purpose, code, cancellationToken);
}

/// <summary>Records delivery attempts without touching Bale or an SMS provider.</summary>
public sealed class FakeVoteOtpSender : IVoteOtpSender
{
    /// <summary>Channels to report as delivered. Both true by default.</summary>
    public bool ViaBale { get; set; } = true;

    public bool ViaSms { get; set; } = true;

    public int SendCount { get; private set; }

    /// <summary>The phone the code was last sent to — asserted to be the ORG's number, not a typed one.</summary>
    public string? LastPhone { get; private set; }

    public void Reset()
    {
        ViaBale = true;
        ViaSms = true;
        SendCount = 0;
        LastPhone = null;
        _delivered.Clear();
    }

    /// <summary>Every code that was handed to a delivery channel, so a test can assert it never leaked.</summary>
    public IReadOnlyList<string> DeliveredCodes => _delivered;

    private readonly List<string> _delivered = [];

    public Task<OtpDelivery> SendAsync(
        string phone,
        string code,
        CancellationToken cancellationToken)
    {
        SendCount++;
        LastPhone = phone;
        _delivered.Add(code);
        return Task.FromResult(new OtpDelivery(ViaBale, ViaSms));
    }
}
