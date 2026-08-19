using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text;
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
    /// <c>mihan</c>, <c>relay</c>, or anything else to log only.
    /// </summary>
    /// <remarks>
    /// Deliberately does NOT default to a real provider. An unrecognised value logs and reports
    /// <b>false</b> — not delivered — so a misconfiguration shows up as "the SMS channel failed" rather
    /// than as a code the voter never receives while the bot claims it was sent.
    /// </remarks>
    public string Provider { get; init; } = "log";

    public string MihanEndpoint { get; init; } = "http://www.mihansmscenter.com/webservice/index.php";
    public string? MihanUsername { get; init; }
    public string? MihanPassword { get; init; }
    public string? MihanSender { get; init; }

    public string RelayBaseUrl { get; init; } = "https://sms.kurdnezambargh.ir";
    public string RelayToken { get; init; } = string.Empty;
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
            _ => LogOnly(message)
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
