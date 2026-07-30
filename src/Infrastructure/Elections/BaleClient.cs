using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Mabhas19.Application.Common.Interfaces.Elections;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.Elections;

/// <inheritdoc cref="IBaleClient"/>
/// <remarks>
/// Bale's bot API is a near-clone of Telegram's, so the method names and payload shapes are the ones you
/// would expect: <c>sendMessage</c> with <c>chat_id</c>/<c>text</c>, and <c>reply_markup</c> carrying an
/// <c>inline_keyboard</c>.
/// </remarks>
internal sealed class BaleClient(
    HttpClient http,
    IOptions<BaleOptions> options,
    ILogger<BaleClient> logger) : IBaleClient
{
    private readonly BaleOptions _options = options.Value;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_options.BotToken);

    public async Task<bool> SendMessageAsync(
        long chatId,
        string text,
        BaleKeyboard? keyboard = null,
        CancellationToken cancellationToken = default)
    {
        var payload = new SendMessageRequest(
            chatId,
            text,
            keyboard is null ? null : new ReplyMarkup(ToRows(keyboard)));

        return await PostAsync("sendMessage", payload, cancellationToken);
    }

    public async Task AnswerCallbackAsync(
        string callbackQueryId,
        string? text = null,
        CancellationToken cancellationToken = default)
        => await PostAsync("answerCallbackQuery", new AnswerCallbackRequest(callbackQueryId, text), cancellationToken);

    /// <summary>
    /// Posts a bot API method. Never throws.
    /// </summary>
    /// <remarks>
    /// Bale re-delivers any webhook update it does not get a 200 for, and a re-delivered update replays
    /// whatever the user's message triggered. A failed reply must therefore not become an exception that
    /// escapes the handler — losing a message is better than replaying a conversation step.
    /// </remarks>
    private async Task<bool> PostAsync(string method, object payload, CancellationToken cancellationToken)
    {
        if (!IsConfigured)
        {
            logger.LogWarning("Bale {Method} skipped: no bot token configured.", method);
            return false;
        }

        try
        {
            // The token goes in the PATH, which is why this client is registered with
            // .RemoveAllLoggers() — IHttpClientFactory's default logging would otherwise print the
            // request URI, token included, on every send. See DependencyInjection.cs.
            using var response = await http.PostAsJsonAsync(
                $"bot{_options.BotToken}/{method}", payload, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                return true;
            }

            // Body, not just the status: Bale returns a description like "chat not found" that is the
            // only way to tell a blocked bot from a wrong token. It contains no کد ملی.
            var body = await response.Content.ReadAsStringAsync(cancellationToken);
            logger.LogWarning(
                "Bale {Method} failed with {Status}: {Body}", method, (int)response.StatusCode, body);
            return false;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Bale {Method} threw.", method);
            return false;
        }
    }

    private static List<List<InlineButton>> ToRows(BaleKeyboard keyboard) =>
        keyboard.Rows
            .Select(row => row.Select(b => new InlineButton(b.Text, b.CallbackData)).ToList())
            .ToList();

    // Snake-case names because the API is a Telegram clone; the host's camelCase default would send
    // "chatId" and be ignored, which looks exactly like a silent delivery failure.
    private sealed record SendMessageRequest(
        [property: JsonPropertyName("chat_id")] long ChatId,
        [property: JsonPropertyName("text")] string Text,
        [property: JsonPropertyName("reply_markup")] ReplyMarkup? ReplyMarkup);

    private sealed record ReplyMarkup(
        [property: JsonPropertyName("inline_keyboard")] List<List<InlineButton>> InlineKeyboard);

    private sealed record InlineButton(
        [property: JsonPropertyName("text")] string Text,
        [property: JsonPropertyName("callback_data")] string CallbackData);

    private sealed record AnswerCallbackRequest(
        [property: JsonPropertyName("callback_query_id")] string CallbackQueryId,
        [property: JsonPropertyName("text")] string? Text);
}
