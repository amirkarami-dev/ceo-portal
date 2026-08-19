using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Xml;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.Elections;

/// <summary>SMS for the election API. Returns whether the message was accepted.</summary>
public interface IElectionSmsSender
{
    Task<bool> SendAsync(string phone, string message, CancellationToken cancellationToken);
}

/// <summary>
/// Options for the API-side SMS sender.
/// </summary>
/// <remarks>
/// Bound to the <b>same <c>Sms</c> configuration section as the identity provider</b>, on purpose: the
/// production environment variables (<c>Sms__Provider</c>, <c>Sms__Mihan*</c>, <c>Sms__Relay*</c>) already
/// exist and are already injected, so the vote channel needs no new secret and no new deploy step. A
/// second set of names would be one more thing to forget the day an election runs.
/// </remarks>
public sealed class ElectionSmsOptions
{
    public const string SectionName = "Sms";

    /// <summary>
    /// <c>mihan</c>, <c>relay</c>, <c>direct</c> (msgway), or <c>log</c> to log only.
    /// </summary>
    /// <remarks>
    /// Deliberately does NOT default to a real provider. An unrecognised value is <b>refused</b> —
    /// logged as an error and reported as <b>false</b>, not delivered — so a misconfiguration shows up
    /// as "the SMS channel failed" rather than as a code the voter never receives while the bot claims
    /// it was sent.
    /// </remarks>
    public string Provider { get; init; } = "log";

    public string MihanEndpoint { get; init; } = "http://www.mihansmscenter.com/webservice/index.php";
    public string? MihanUsername { get; init; }
    public string? MihanPassword { get; init; }
    public string? MihanSender { get; init; }

    public string RelayBaseUrl { get; init; } = "https://sms.kurdnezambargh.ir";
    public string RelayToken { get; init; } = string.Empty;

    // --- Direct msgway.com sending (Provider = "direct") ---
    // Names mirror src/Auth/Sms/SmsOptions.cs exactly: both hosts bind the same "Sms" section, so the
    // environment already carries these values under these keys.

    /// <summary>msgway API base URL.</summary>
    public string MsgwayBaseUrl { get; init; } = "https://api.msgway.com";

    /// <summary>msgway API key (sent as the "apiKey" header). Injected at deploy time; never hardcoded.</summary>
    public string? MsgwayApiKey { get; init; }

    /// <summary>msgway provider id. Default 0.</summary>
    public int MsgwayProvider { get; init; }

    /// <summary>msgway template id whose Param1 is the verification code.</summary>
    public int MsgwayTemplateId { get; init; }
}

/// <summary>
/// Sends the vote code by SMS.
/// </summary>
/// <remarks>
/// <para>
/// <b>This duplicates the transport in <c>src/Auth/Sms</c>.</b> The identity provider does not reference
/// <c>src/Shared</c>, so sharing the code would mean adding a project reference to the live login host to
/// support a new feature — the design ruled that out. The duplication is narrow (two providers, no
/// factory, no templates) and is recorded in `GOTCHAS.md`: if the Mihan envelope or the relay contract
/// changes, <b>both</b> copies must change.
/// </para>
/// <para>
/// <b>The phone number is never logged.</b> The IdP's sender logs <c>{Phone}</c> on every path; for a vote
/// that is a registered mobile next to a timestamp, which is a voter-roll entry in the application log.
/// Status codes and exceptions only.
/// </para>
/// </remarks>
internal sealed partial class ElectionSmsSender(
    HttpClient http,
    IOptions<ElectionSmsOptions> options,
    ILogger<ElectionSmsSender> logger) : IElectionSmsSender, Mabhas19.Application.Common.Interfaces.ISmsSender
{
    private const string SoapAction = "\"http://www.mihansmscenter.com/webservice/#send\"";
    private const string MihanNs = "http://www.mihansmscenter.com/webservice/";
    private const string SoapNs = "http://schemas.xmlsoap.org/soap/envelope/";

    private readonly ElectionSmsOptions _options = options.Value;

    [GeneratedRegex(@"\d{4,8}")]
    private static partial Regex CodePattern();

    public async Task<bool> SendAsync(string phone, string message, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(phone))
        {
            return false;
        }

        return _options.Provider.ToLowerInvariant() switch
        {
            "mihan" => await SendMihanAsync(phone, message, cancellationToken),
            "relay" => await SendRelayAsync(phone, message, cancellationToken),
            "direct" => await SendDirectAsync(phone, message, cancellationToken),
            "log" => LogOnly(message),
            _ => UnknownProvider()
        };
    }

    /// <remarks>
    /// Development path. Reports <b>true</b> so a local run behaves like a working channel; the code is in
    /// the log, which is where a developer looks for it. Never enabled in production, where
    /// <c>Sms__Provider</c> is set.
    /// </remarks>
    private bool LogOnly(string message)
    {
        logger.LogInformation("[vote-sms:log] {Message}", message);
        return true;
    }

    /// <remarks>
    /// A configured value that matches none of the known providers used to fall through to
    /// <see cref="LogOnly"/> and report <b>true</b> — a channel that claims success it cannot deliver is
    /// worse than one that fails outright: the caller surfaces a <c>false</c> to a human who can act on
    /// it, while a silent <c>true</c> hides the failure until someone notices the code or the link never
    /// arrived. So an unrecognised provider is logged as an error, naming the configured value, and
    /// reports <b>false</b>.
    /// </remarks>
    private bool UnknownProvider()
    {
        logger.LogError(
            "Vote SMS: unrecognised Sms:Provider {Provider}. Refusing to report success.", _options.Provider);
        return false;
    }

    private async Task<bool> SendRelayAsync(string phone, string message, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.RelayToken))
        {
            logger.LogWarning("Vote SMS relay is selected but no token is configured.");
            return false;
        }

        // The relay delivers a CODE, not a sentence. A message carrying a link is not a code, and
        // silently posting some digit-run out of the middle of it would report success while
        // delivering something meaningless. Refuse loudly instead so the caller can surface it.
        if (message.Contains("http://", StringComparison.OrdinalIgnoreCase)
            || message.Contains("https://", StringComparison.OrdinalIgnoreCase))
        {
            logger.LogError(
                "SMS relay was asked to send a message containing a link, but this relay only " +
                "delivers numeric codes. Message not sent.");
            return false;
        }

        // The relay takes the code, not the sentence — same contract as the IdP's relay path.
        var match = CodePattern().Match(message);
        if (!match.Success)
        {
            logger.LogWarning("Vote SMS relay: no code found in the message.");
            return false;
        }

        try
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Post, $"{_options.RelayBaseUrl.TrimEnd('/')}/send")
            {
                Content = JsonContent.Create(new { phone, code = match.Value })
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.RelayToken);

            using var response = await http.SendAsync(request, ct);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Vote SMS relay failed with {Status}.", (int)response.StatusCode);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Vote SMS relay threw.");
            return false;
        }
    }

    private async Task<bool> SendMihanAsync(string phone, string message, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.MihanUsername)
            || string.IsNullOrWhiteSpace(_options.MihanPassword)
            || string.IsNullOrWhiteSpace(_options.MihanSender))
        {
            logger.LogWarning("Vote SMS: Mihan credentials are not configured.");
            return false;
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, _options.MihanEndpoint)
            {
                Content = new StringContent(Envelope(phone, message), Encoding.UTF8, "text/xml")
            };
            request.Headers.TryAddWithoutValidation("SOAPAction", SoapAction);

            using var response = await http.SendAsync(request, ct);

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning("Vote SMS via Mihan failed with {Status}.", (int)response.StatusCode);
                return false;
            }

            // A 200 from Mihan is acceptance, not proof of handset delivery — nothing here can prove
            // that, which is exactly why the code also goes out over Bale.
            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Vote SMS via Mihan threw.");
            return false;
        }
    }

    /// <summary>
    /// Sends the code directly through msgway.com, mirroring
    /// <c>src/Auth/Sms/SmsDirectSender.SendAsync</c>.
    /// </summary>
    /// <remarks>
    /// msgway answers HTTP 200 with its real verdict inside the response <b>body</b>
    /// (<c>{"status":"success","error":null,"referenceID":"…"}</c> for an accepted send, some other
    /// <c>status</c> for a refused one). Trusting <see cref="HttpResponseMessage.IsSuccessStatusCode"/>
    /// alone reports success for a send msgway actually refused — that exact gap once locked an
    /// engineer out of the welfare service with no error anywhere. The body is read and its
    /// <c>status</c> field is what decides the return value here, not the HTTP status code.
    /// </remarks>
    private async Task<bool> SendDirectAsync(string phone, string message, CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(_options.MsgwayApiKey) || _options.MsgwayTemplateId <= 0)
        {
            logger.LogWarning("Vote SMS: msgway (direct) is not configured (MsgwayApiKey/MsgwayTemplateId).");
            return false;
        }

        // The direct path takes the code, not the sentence — same contract as the relay and as the
        // IdP's own direct sender.
        var match = CodePattern().Match(message);
        if (!match.Success)
        {
            logger.LogWarning("Vote SMS direct: no code found in the message.");
            return false;
        }

        try
        {
            using var request = new HttpRequestMessage(
                HttpMethod.Post, $"{_options.MsgwayBaseUrl.TrimEnd('/')}/send")
            {
                // Field names/casing match the legacy msgway payload — same shape as the IdP's direct
                // sender. No "Length" field — that would put msgway in generate-its-own-code mode and
                // the delivered code would not match the one we stored.
                Content = JsonContent.Create(new
                {
                    Method = "sms",
                    provider = _options.MsgwayProvider,
                    Smart = false,
                    Mobile = phone,
                    TemplateID = _options.MsgwayTemplateId,
                    Param1 = match.Value,
                }),
            };
            request.Headers.TryAddWithoutValidation("apiKey", _options.MsgwayApiKey);
            request.Headers.TryAddWithoutValidation("accept-language", "en-IR");

            using var response = await http.SendAsync(request, ct);

            // Read the body before trusting anything — see the remarks above.
            var body = await response.Content.ReadAsStringAsync(ct);
            var summary = body.Length > 500 ? body[..500] : body;

            if (!response.IsSuccessStatusCode)
            {
                logger.LogWarning(
                    "Vote SMS via msgway failed with {Status}: {Body}", (int)response.StatusCode, summary);
                return false;
            }

            if (!IsMsgwaySuccess(body))
            {
                logger.LogWarning("Vote SMS via msgway was refused: {Body}", summary);
                return false;
            }

            return true;
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Vote SMS via msgway threw.");
            return false;
        }
    }

    /// <summary>
    /// Parses the msgway response body and returns whether it reports <c>"status":"success"</c>.
    /// Any other status, a missing field, or a body that is not valid JSON is treated as failure —
    /// this method must never turn an unreadable body into a false "sent".
    /// </summary>
    private static bool IsMsgwaySuccess(string body)
    {
        try
        {
            using var doc = JsonDocument.Parse(body);
            return doc.RootElement.TryGetProperty("status", out var status)
                && string.Equals(status.GetString(), "success", StringComparison.OrdinalIgnoreCase);
        }
        catch (JsonException)
        {
            return false;
        }
    }

    /// <summary>
    /// The Mihan SOAP envelope. Must stay byte-for-byte equivalent to
    /// <c>src/Auth/Sms/MihanSmsSender.CreateEnvelope</c>.
    /// </summary>
    private string Envelope(string phone, string message)
    {
        using var stream = new MemoryStream();
        using (var writer = XmlWriter.Create(stream, new XmlWriterSettings
        {
            Encoding = Encoding.UTF8,
            OmitXmlDeclaration = false
        }))
        {
            writer.WriteStartDocument();
            writer.WriteStartElement("soapenv", "Envelope", SoapNs);
            writer.WriteAttributeString("xmlns", "xsi", null, "http://www.w3.org/2001/XMLSchema-instance");
            writer.WriteAttributeString("xmlns", "xsd", null, "http://www.w3.org/2001/XMLSchema");
            writer.WriteAttributeString("xmlns", "web", null, MihanNs);
            writer.WriteStartElement("soapenv", "Body", SoapNs);
            writer.WriteStartElement("web", "send", MihanNs);
            Typed(writer, "username", _options.MihanUsername!);
            Typed(writer, "password", _options.MihanPassword!);
            Typed(writer, "to", phone);
            Typed(writer, "from", _options.MihanSender!);
            Typed(writer, "message", message);
            Typed(writer, "send_time", "0", "int");
            Typed(writer, "check_duplicate", "false", "boolean");
            Typed(writer, "udh", string.Empty);
            writer.WriteEndElement();
            writer.WriteEndElement();
            writer.WriteEndElement();
            writer.WriteEndDocument();
        }

        return Encoding.UTF8.GetString(stream.ToArray());
    }

    private static void Typed(XmlWriter writer, string name, string value, string type = "string")
    {
        writer.WriteStartElement("web", name, MihanNs);
        writer.WriteAttributeString(
            "xsi", "type", "http://www.w3.org/2001/XMLSchema-instance", $"xsd:{type}");
        writer.WriteString(value);
        writer.WriteEndElement();
    }
}
