namespace Mabhas19.Application.Common.Interfaces.Elections;

/// <summary>One tappable button. <paramref name="CallbackData"/> is limited to 64 bytes by the API.</summary>
public sealed record BaleButton(string Text, string CallbackData);

/// <summary>An inline keyboard: rows of buttons, rendered under the message.</summary>
public sealed record BaleKeyboard(IReadOnlyList<IReadOnlyList<BaleButton>> Rows);

/// <summary>
/// Outbound calls to the Bale bot API (<c>https://tapi.bale.ai/bot{token}/</c>), a near-clone of
/// Telegram's.
/// </summary>
/// <remarks>
/// Every method is best-effort and must never throw into the webhook handler. Bale retries a webhook it
/// gets no 200 for, and a retried update would re-run whatever the user's message triggered — including,
/// in the worst case, a second cast attempt. Failing to send a reply is a bad experience; failing to
/// return 200 is a correctness problem.
/// </remarks>
public interface IBaleClient
{
    /// <summary>False when no bot token is configured, so the webhook can refuse up front.</summary>
    bool IsConfigured { get; }

    /// <summary>Sends a message. Returns false if the send failed.</summary>
    Task<bool> SendMessageAsync(
        long chatId,
        string text,
        BaleKeyboard? keyboard = null,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Acknowledges a button tap. Bale shows a spinner on the button until this is called, so it is
    /// sent even when the answer is "nothing happened".
    /// </summary>
    Task AnswerCallbackAsync(
        string callbackQueryId,
        string? text = null,
        CancellationToken cancellationToken = default);
}
