using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json.Serialization;
using Mabhas19.Application.Common;
using Mabhas19.Application.Common.Interfaces.Elections;
using Mabhas19.Application.Elections.Bale;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.Elections;

/// <summary>
/// Sends a vote code over Bale <b>and</b> SMS at the same time — both addressed to the phone number the
/// organisation has on record.
/// </summary>
/// <remarks>
/// <para>
/// Both channels are attempted for every code and the caller is told which ones worked. Sending to only
/// one would strand anyone whose Bale client is signed out or whose SIM is elsewhere, and during a
/// two-hour voting window there is no time to work out which.
/// </para>
/// <para>
/// <b>The code is NEVER sent into the Bale conversation.</b> An adversarial review caught the earlier
/// version doing exactly that, and it was a complete authentication bypass: کد ملی is a public number in
/// Iran, so anyone could open their own chat with the bot, type a member's کد ملی, read the code off their
/// own screen and cast that member's ballot. Worse, it was irreversible — the roll's UNIQUE key then
/// reports the real member as having already voted, on both channels, and the sealed ballot is unlinkable
/// so the theft can neither be identified nor undone.
/// </para>
/// <para>
/// The Bale channel is therefore <b>safir</b>, which pushes to a Bale account <i>by phone number</i>
/// (<c>safir.bale.ai/api/v3/send_message</c>) — the same binding as the SMS. This is what the design
/// specified; the in-chat send was an invention on top of it.
/// </para>
/// </remarks>
internal sealed class VoteOtpSender(
    IBaleSafirSender safir,
    IElectionSmsSender sms,
    ILogger<VoteOtpSender> logger) : IVoteOtpSender
{
    public async Task<OtpDelivery> SendAsync(
        string phone,
        string code,
        CancellationToken cancellationToken)
    {
        var text = BaleTexts.OtpCode(code);

        // Fired together rather than in sequence: a slow or hanging channel must not delay the other,
        // and the code's TTL is counted from now.
        var baleTask = SendViaBaleAsync(phone, text, cancellationToken);
        var smsTask = SendViaSmsAsync(phone, text, cancellationToken);

        var results = await Task.WhenAll(baleTask, smsTask);
        var delivery = new OtpDelivery(results[0], results[1]);

        if (!delivery.AnyDelivered)
        {
            // No phone number and no code in the log line — this is the only thing worth recording.
            logger.LogError("Vote OTP could not be delivered on either channel.");
        }

        return delivery;
    }

    /// <summary>Bale push addressed to the registered phone, never to a conversation.</summary>
    private async Task<bool> SendViaBaleAsync(string phone, string text, CancellationToken ct)
    {
        try
        {
            return await safir.SendAsync(phone, text, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Vote OTP Bale channel threw.");
            return false;
        }
    }

    private async Task<bool> SendViaSmsAsync(string phone, string text, CancellationToken ct)
    {
        try
        {
            return await sms.SendAsync(phone, text, ct);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Vote OTP SMS channel threw.");
            return false;
        }
    }
}

/// <summary>Push a message to a Bale account by phone number, for people who never started the bot.</summary>
public interface IBaleSafirSender
{
    Task<bool> SendAsync(string phone, string text, CancellationToken cancellationToken);
}

/// <inheritdoc cref="IBaleSafirSender"/>
/// <remarks>
/// The request shape is taken from the sample on
/// <c>business.bale.ai/dashboard/safir</c>:
/// <code>
/// POST https://safir.bale.ai/api/v3/send_message
/// api-access-key: &lt;key&gt;
/// { "bot_id": 1234567890,
///   "phone_number": "989120000000",
///   "message_data": { "message": { "text": "…" } } }
/// </code>
/// Three details are easy to get wrong and all three fail the same silent way — safir refuses, the Bale
/// channel reports "not delivered", and SMS quietly carries every code:
/// <list type="number">
/// <item><c>bot_id</c> is <b>required</b> and is a number, not a string.</item>
/// <item>The text is nested two levels deep under <c>message_data.message.text</c>.</item>
/// <item>The phone is <b>country-code form with no plus and no leading zero</b> — <c>989120000000</c>,
/// not <c>09120000000</c> and not <c>9120000000</c>. See <see cref="ToSafirPhone"/>.</item>
/// </list>
/// </remarks>
internal sealed class BaleSafirSender(
    HttpClient http,
    IOptions<BaleOptions> options,
    ILogger<BaleSafirSender> logger) : IBaleSafirSender
{
    private readonly BaleOptions _options = options.Value;

    public async Task<bool> SendAsync(string phone, string text, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(_options.SafirAccessKey) || _options.SafirBotId <= 0)
        {
            // Not an error: without the key or the bot id this channel does not exist and SMS carries
            // the code. Reporting false (rather than pretending) is what lets the caller tell the voter
            // which channel actually worked.
            return false;
        }

        var target = ToSafirPhone(phone);
        if (target is null)
        {
            logger.LogWarning("Bale safir push skipped: the stored mobile is not a usable Iranian number.");
            return false;
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, "api/v3/send_message")
            {
                Content = JsonContent.Create(
                    new SafirRequest(_options.SafirBotId, target, new SafirMessageData(new SafirText(text))))
            };

            // Header, never a query string — a credential in a URL lands in every proxy access log.
            request.Headers.TryAddWithoutValidation("api-access-key", _options.SafirAccessKey);
            request.Headers.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

            using var response = await http.SendAsync(request, cancellationToken);

            if (response.IsSuccessStatusCode)
            {
                return true;
            }

            // Status only. The body of a failed safir call echoes the phone number back.
            logger.LogWarning("Bale safir push failed with {Status}.", (int)response.StatusCode);
            return false;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Bale safir push threw.");
            return false;
        }
    }

    /// <summary>
    /// The organisation's stored mobile in the form safir wants: <c>98</c> + the 10-digit number,
    /// e.g. <c>09120000000</c> → <c>989120000000</c>. Null when it is not a usable Iranian mobile.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Public and separately tested because it is the single most likely thing to be wrong here, and
    /// being wrong is invisible: safir just refuses and SMS silently becomes the only channel.
    /// </para>
    /// <para>
    /// The membership database is not consistent — the same column holds <c>09120000000</c>,
    /// <c>9120000000</c>, <c>+98 912 000 0000</c> and <c>00989120000000</c>. All four are the same
    /// person, so all four must produce the same string.
    /// </para>
    /// <para>
    /// Returns null rather than guessing on anything else. A landline or a truncated number would
    /// otherwise be sent to safir as though it were a mobile, and any reply would go to a stranger.
    /// </para>
    /// </remarks>
    public static string? ToSafirPhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
        {
            return null;
        }

        // Persian digits arrive from the org DB too, so fold them before filtering.
        var digits = new string(
            JalaliDate.NormalizeDigits(phone).Where(char.IsAsciiDigit).ToArray());

        // International dialling prefix, e.g. 00989120000000.
        if (digits.StartsWith("00", StringComparison.Ordinal))
        {
            digits = digits[2..];
        }

        // Already country-coded: 98 followed by a 10-digit mobile starting 9.
        if (digits is { Length: 12 } && digits.StartsWith("989", StringComparison.Ordinal))
        {
            return digits;
        }

        // National form with the trunk zero: 09120000000.
        if (digits is { Length: 11 } && digits.StartsWith("09", StringComparison.Ordinal))
        {
            return "98" + digits[1..];
        }

        // Bare mobile without the zero: 9120000000.
        if (digits is { Length: 10 } && digits.StartsWith('9'))
        {
            return "98" + digits;
        }

        return null;
    }

    // Field names and nesting are from the safir sample; see the class remarks. Pinned by
    // SafirRequestContractTests, because getting any of them wrong fails silently.
    private sealed record SafirRequest(
        [property: JsonPropertyName("bot_id")] long BotId,
        [property: JsonPropertyName("phone_number")] string PhoneNumber,
        [property: JsonPropertyName("message_data")] SafirMessageData MessageData);

    private sealed record SafirMessageData(
        [property: JsonPropertyName("message")] SafirText Message);

    private sealed record SafirText(
        [property: JsonPropertyName("text")] string Text);
}
