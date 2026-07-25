using System.Net;
using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Auth.Sms;

/// <summary>
/// Sends SMS via an external OTP relay microservice or Kavenegar (a common Iranian provider)
/// when configured, otherwise logs the message (development). Swap in another provider by
/// extending <see cref="SendAsync"/>.
/// </summary>
public class SmsSender : ISmsSender
{
    private readonly HttpClient _http;
    private readonly SmsOptions _options;
    private readonly ILogger<SmsSender> _logger;

    public SmsSender(HttpClient http, IOptions<SmsOptions> options, ILogger<SmsSender> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendAsync(string phoneNumber, string message, CancellationToken ct = default)
    {
        if (string.Equals(_options.Provider, "relay", StringComparison.OrdinalIgnoreCase))
        {
            var match = Regex.Match(message, @"\d{4,8}");
            if (!match.Success)
            {
                _logger.LogWarning("OTP relay: no code found in message for {Phone}", phoneNumber);
                return;
            }

            var url = $"{_options.RelayBaseUrl.TrimEnd('/')}/send";
            try
            {
                using var request = new HttpRequestMessage(HttpMethod.Post, url)
                {
                    Content = JsonContent.Create(new { phone = phoneNumber, code = match.Value }),
                };
                request.Headers.Authorization =
                    new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", _options.RelayToken);

                using var response = await _http.SendAsync(request, ct);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("OTP relay send failed ({Status}) for {Phone}", response.StatusCode, phoneNumber);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "OTP relay send error for {Phone}", phoneNumber);
            }

            return;
        }

        if (string.Equals(_options.Provider, "kavenegar", StringComparison.OrdinalIgnoreCase)
            && !string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            var url = $"https://api.kavenegar.com/v1/{_options.ApiKey}/sms/send.json"
                + $"?receptor={WebUtility.UrlEncode(phoneNumber)}"
                + $"&message={WebUtility.UrlEncode(message)}"
                + (string.IsNullOrWhiteSpace(_options.Sender) ? "" : $"&sender={WebUtility.UrlEncode(_options.Sender)}");

            try
            {
                var response = await _http.GetAsync(url, ct);
                if (!response.IsSuccessStatusCode)
                {
                    _logger.LogWarning("SMS send failed ({Status}) for {Phone}", response.StatusCode, phoneNumber);
                }
                return;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "SMS send error for {Phone}", phoneNumber);
                return;
            }
        }

        _logger.LogInformation("[SMS:log] to {Phone}: {Message}", phoneNumber, message);
        await Task.CompletedTask;
    }
}
