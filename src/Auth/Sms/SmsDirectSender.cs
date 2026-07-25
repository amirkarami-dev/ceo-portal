using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Auth.Sms;

/// <summary>
/// Sends the OTP directly through msgway.com (POST https://api.msgway.com/send) — the same
/// provider used in the legacy project. msgway is template-based, so the verification code is
/// extracted from the message (the same way <see cref="SmsSender"/> does for the relay) and
/// passed as Param1 of the configured template. Selected with <see cref="SmsOptions.Provider"/>
/// = "direct".
/// </summary>
public class SmsDirectSender : ISmsSender
{
    private readonly HttpClient _http;
    private readonly SmsOptions _options;
    private readonly ILogger<SmsDirectSender> _logger;

    public SmsDirectSender(HttpClient http, IOptions<SmsOptions> options, ILogger<SmsDirectSender> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendAsync(string phoneNumber, string message, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_options.MsgwayApiKey) || _options.MsgwayTemplateId <= 0)
        {
            _logger.LogWarning(
                "[SMS:direct] msgway not configured (MsgwayApiKey/MsgwayTemplateId); logging instead. To {Phone}: {Message}",
                phoneNumber, message);
            return;
        }

        // The verification code is the only number in the message (same extraction the relay uses).
        var match = Regex.Match(message, @"\d{4,8}");
        if (!match.Success)
        {
            _logger.LogWarning("msgway: no code found in message for {Phone}", phoneNumber);
            return;
        }
        var code = match.Value;

        var url = $"{_options.MsgwayBaseUrl.TrimEnd('/')}/send";
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                // Field names/casing match the legacy msgway payload.
                // Payload matches the proven msgway structure (VahedGas MsgWaySmsSender): the code is
                // supplied as Param1. No "Length" field — that would put msgway in generate-its-own-code
                // mode and the delivered code would not match the one we stored.
                Content = JsonContent.Create(new
                {
                    Method = "sms",
                    provider = _options.MsgwayProvider,
                    Smart = false,
                    Mobile = phoneNumber,
                    TemplateID = _options.MsgwayTemplateId,
                    Param1 = code,
                }),
            };
            request.Headers.TryAddWithoutValidation("apiKey", _options.MsgwayApiKey);
            request.Headers.TryAddWithoutValidation("accept-language", "en-IR");

            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("msgway send failed ({Status}) for {Phone}", response.StatusCode, phoneNumber);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "msgway send error for {Phone}", phoneNumber);
        }
    }
}
