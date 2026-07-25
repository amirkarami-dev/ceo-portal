using System.Text;
using System.Xml;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Auth.Sms;

/// <summary>
/// Sends the final OTP message through Mihan SMS Center's SOAP API. Unlike template-based
/// providers, Mihan accepts the complete message and does not require a parameter slot.
/// </summary>
public class MihanSmsSender : ISmsSender
{
    private const string SoapAction = "\"http://www.mihansmscenter.com/webservice/#send\"";

    private readonly HttpClient _http;
    private readonly SmsOptions _options;
    private readonly ILogger<MihanSmsSender> _logger;

    public MihanSmsSender(HttpClient http, IOptions<SmsOptions> options, ILogger<MihanSmsSender> logger)
    {
        _http = http;
        _options = options.Value;
        _logger = logger;
    }

    public async Task SendAsync(string phoneNumber, string message, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(_options.MihanUsername)
            || string.IsNullOrWhiteSpace(_options.MihanPassword)
            || string.IsNullOrWhiteSpace(_options.MihanSender))
        {
            _logger.LogWarning("[SMS:mihan] MihanUsername, MihanPassword, or MihanSender is not configured; SMS was not sent to {Phone}", phoneNumber);
            return;
        }

        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, _options.MihanEndpoint)
            {
                Content = new StringContent(CreateEnvelope(phoneNumber, message), Encoding.UTF8, "text/xml"),
            };
            request.Headers.TryAddWithoutValidation("SOAPAction", SoapAction);

            using var response = await _http.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Mihan SMS send failed ({Status}) for {Phone}", response.StatusCode, phoneNumber);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Mihan SMS send error for {Phone}", phoneNumber);
        }
    }

    private string CreateEnvelope(string phoneNumber, string message)
    {
        using var stream = new MemoryStream();
        using (var writer = XmlWriter.Create(stream, new XmlWriterSettings
        {
            Encoding = Encoding.UTF8,
            OmitXmlDeclaration = false,
        }))
        {
            writer.WriteStartDocument();
            writer.WriteStartElement("soapenv", "Envelope", "http://schemas.xmlsoap.org/soap/envelope/");
            writer.WriteAttributeString("xmlns", "xsi", null, "http://www.w3.org/2001/XMLSchema-instance");
            writer.WriteAttributeString("xmlns", "xsd", null, "http://www.w3.org/2001/XMLSchema");
            writer.WriteAttributeString("xmlns", "web", null, "http://www.mihansmscenter.com/webservice/");
            writer.WriteStartElement("soapenv", "Body", "http://schemas.xmlsoap.org/soap/envelope/");
            writer.WriteStartElement("web", "send", "http://www.mihansmscenter.com/webservice/");
            WriteTypedValue(writer, "username", _options.MihanUsername!);
            WriteTypedValue(writer, "password", _options.MihanPassword!);
            WriteTypedValue(writer, "to", phoneNumber);
            WriteTypedValue(writer, "from", _options.MihanSender!);
            WriteTypedValue(writer, "message", message);
            WriteTypedValue(writer, "send_time", "0", "int");
            WriteTypedValue(writer, "check_duplicate", "false", "boolean");
            WriteTypedValue(writer, "udh", string.Empty);
            writer.WriteEndElement();
            writer.WriteEndElement();
            writer.WriteEndElement();
            writer.WriteEndDocument();
        }

        return Encoding.UTF8.GetString(stream.ToArray());
    }

    private static void WriteTypedValue(XmlWriter writer, string name, string value, string type = "string")
    {
        writer.WriteStartElement("web", name, "http://www.mihansmscenter.com/webservice/");
        writer.WriteAttributeString("xsi", "type", "http://www.w3.org/2001/XMLSchema-instance", $"xsd:{type}");
        writer.WriteString(value);
        writer.WriteEndElement();
    }
}