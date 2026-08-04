namespace Mabhas19.Infrastructure.MunSanandaj;

/// <summary>
/// Configuration for the mahyapardaz REST API. The KurdNezam SQL connection string is bound
/// separately from ConnectionStrings:KurdNezamDb (kept out of this section, same reasoning as
/// FarsNezamOptions, so it can live in env/.env without leaking into appsettings).
/// </summary>
public class MunSanandajOptions
{
    public const string SectionName = "MunSanandaj";

    /// <summary>Bearer token for the mahyapardaz REST API.</summary>
    public string ApiToken { get; set; } = string.Empty;

    /// <summary>
    /// Hours between automatic sync runs. Defaults to 2. Override with
    /// <c>MunSanandaj__IntervalHours</c> — no rebuild needed.
    /// </summary>
    /// <remarks>
    /// The worker also runs once at startup, so every deploy fires an extra run on top of this.
    /// </remarks>
    public int IntervalHours { get; set; } = 2;

    /// <summary>
    /// Accept the report-PDF host's TLS certificate when the <b>only</b> thing wrong with it is that
    /// it has expired, and its public key still matches <see cref="PdfCertificatePublicKeyPin"/>.
    /// </summary>
    /// <remarks>
    /// A stopgap for exactly one situation: the certificate on <c>eservice.kurdnezam.ir</c> expired
    /// on 21 Jul 2026 and the sync has been dead since. Plain HTTP is not an alternative — port 80
    /// on that host is firewalled, so <c>http://</c> just times out.
    /// <para>
    /// This is NOT "ignore certificate errors". The pin is the safety: an attacker cannot complete a
    /// handshake with the real certificate without its private key, and any substituted certificate
    /// — even a currently-valid one from a real CA — has a different public key and is refused. Any
    /// error other than expiry is refused too.
    /// </para>
    /// <para>
    /// <b>Turn this off once the certificate is renewed.</b> Renewal changes the key, the pin stops
    /// matching, and downloads fail closed rather than silently staying on the weaker path.
    /// </para>
    /// </remarks>
    public bool AllowExpiredPdfCertificate { get; set; }

    /// <summary>
    /// SHA-256 of the report-PDF host's certificate public key (SPKI), lower-case hex, no colons.
    /// Required when <see cref="AllowExpiredPdfCertificate"/> is on; without it nothing is accepted.
    /// Obtain with:
    /// <code>
    /// openssl s_client -servername HOST -connect HOST:443 &lt;/dev/null 2>/dev/null \
    ///   | openssl x509 -noout -pubkey | openssl pkey -pubin -outform der | openssl dgst -sha256
    /// </code>
    /// </summary>
    public string PdfCertificatePublicKeyPin { get; set; } = string.Empty;
}
