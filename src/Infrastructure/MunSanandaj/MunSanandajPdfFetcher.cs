using System.Diagnostics;
using System.Net;
using System.Net.Security;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Mabhas19.Application.Common.Interfaces.MunSanandaj;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.MunSanandaj;

/// <summary>
/// Downloads the pre-generated report PDF (named by Peygiri) and renders its first page to a JPG,
/// base64-encoded — because the municipality's saveEngineerReport endpoint expects an image
/// (<c>data:image/jpg;base64,…</c>), not a PDF. Rendering uses <c>pdftoppm</c> (poppler-utils),
/// installed in the API image.
/// </summary>
/// <remarks>
/// The host serves the same file under <c>/pdf/…</c> and <c>/sm/pdf/…</c> (verified byte-for-byte);
/// the shorter one is used. A missing report is a real 404 on both, which is why "pdf not found" is
/// a returned failure rather than an error.
/// </remarks>
internal sealed class MunSanandajPdfFetcher : IMunSanandajPdfFetcher
{
    private const int RenderDpi = 150;

    private readonly HttpClient _http;
    private readonly ILogger<MunSanandajPdfFetcher> _logger;

    public MunSanandajPdfFetcher(IOptions<MunSanandajOptions> options, ILogger<MunSanandajPdfFetcher> logger)
    {
        _logger = logger;
        _http = BuildClient(options.Value, logger);
    }

    public async Task<string?> FetchAsBase64Async(string peygiri, CancellationToken ct = default)
    {
        // The PDF file is named by the Peygiri (tracking code), not the ProjectNo.
        // https only: port 80 on this host is firewalled (connect times out), so an http:// fallback
        // would only add 20s to every failure and still not work.
        var url = $"https://eservice.kurdnezam.ir/pdf/{peygiri}.pdf";
        using var response = await _http.GetAsync(url, ct);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;
        response.EnsureSuccessStatusCode();
        var pdfBytes = await response.Content.ReadAsByteArrayAsync(ct);

        var jpgBytes = await RenderFirstPageToJpegAsync(pdfBytes, ct);
        return Convert.ToBase64String(jpgBytes);
    }

    /// <summary>
    /// Ordinary <see cref="HttpClient"/> unless the expired-certificate stopgap is switched on, in
    /// which case certificate validation is <b>narrowed</b>, not removed — see
    /// <see cref="MunSanandajOptions.AllowExpiredPdfCertificate"/>.
    /// </summary>
    private static HttpClient BuildClient(MunSanandajOptions options, ILogger logger)
    {
        var timeout = TimeSpan.FromSeconds(60);

        if (!options.AllowExpiredPdfCertificate)
            return new HttpClient { Timeout = timeout };

        var pin = options.PdfCertificatePublicKeyPin?.Replace(":", "").Trim().ToLowerInvariant();
        if (string.IsNullOrEmpty(pin))
        {
            // Fail closed. An operator who turns the switch on but forgets the pin gets normal,
            // strict validation — never "accept anything".
            logger.LogError(
                "MunSanandaj:AllowExpiredPdfCertificate is on but PdfCertificatePublicKeyPin is empty. "
                + "Falling back to strict certificate validation.");
            return new HttpClient { Timeout = timeout };
        }

        logger.LogWarning(
            "MunSanandaj PDF downloads will accept an EXPIRED certificate whose public key matches "
            + "the configured pin. This is a stopgap — turn it off once the certificate is renewed.");

        var handler = new SocketsHttpHandler
        {
            SslOptions = new SslClientAuthenticationOptions
            {
                RemoteCertificateValidationCallback = (_, cert, chain, errors) =>
                    IsExpiredButPinned(cert, chain, errors, pin, logger)
            }
        };

        return new HttpClient(handler) { Timeout = timeout };
    }

    /// <summary>
    /// True only when every one of these holds:
    /// the handshake's sole complaint is a chain error; every chain error is <c>NotTimeValid</c>
    /// (i.e. expiry, nothing else); and the presented certificate's SPKI SHA-256 equals the pin.
    /// A wrong host name, an untrusted root, a revoked certificate or a substituted one — including
    /// a currently-valid certificate from a real CA — all fail here.
    /// </summary>
    private static bool IsExpiredButPinned(
        X509Certificate? cert, X509Chain? chain, SslPolicyErrors errors, string pin, ILogger logger)
    {
        if (errors == SslPolicyErrors.None) return true;
        if (errors != SslPolicyErrors.RemoteCertificateChainErrors) return false;
        if (cert is not X509Certificate2 cert2) return false;

        var statuses = chain?.ChainStatus ?? [];
        if (statuses.Length == 0) return false;
        if (statuses.Any(s => s.Status != X509ChainStatusFlags.NotTimeValid)) return false;

        var spki = Convert.ToHexString(
            SHA256.HashData(cert2.PublicKey.ExportSubjectPublicKeyInfo())).ToLowerInvariant();

        if (spki == pin) return true;

        logger.LogError(
            "Refused the PDF host's certificate: it is expired AND its public key does not match the "
            + "configured pin (presented {Presented}). Someone else may be answering for that host.",
            spki);
        return false;
    }

    /// <summary>Renders page 1 of the PDF to a JPG using <c>pdftoppm</c> via temp files.</summary>
    private async Task<byte[]> RenderFirstPageToJpegAsync(byte[] pdfBytes, CancellationToken ct)
    {
        var workDir = Path.Combine(Path.GetTempPath(), "mun-pdf-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(workDir);
        try
        {
            var pdfPath = Path.Combine(workDir, "in.pdf");
            await File.WriteAllBytesAsync(pdfPath, pdfBytes, ct);

            // pdftoppm -jpeg -r 150 -f 1 -l 1 -singlefile in.pdf out  ->  out.jpg (white background, page 1 only).
            var outPrefix = Path.Combine(workDir, "out");
            var psi = new ProcessStartInfo
            {
                FileName = "pdftoppm",
                RedirectStandardError = true,
                UseShellExecute = false,
            };
            foreach (var arg in new[] { "-jpeg", "-r", RenderDpi.ToString(), "-f", "1", "-l", "1", "-singlefile", pdfPath, outPrefix })
                psi.ArgumentList.Add(arg);

            using var proc = Process.Start(psi)
                ?? throw new InvalidOperationException("Failed to start pdftoppm.");
            var stderr = await proc.StandardError.ReadToEndAsync(ct);
            await proc.WaitForExitAsync(ct);
            if (proc.ExitCode != 0)
                throw new InvalidOperationException($"pdftoppm failed (exit {proc.ExitCode}): {stderr}");

            var jpgPath = outPrefix + ".jpg";
            if (!File.Exists(jpgPath))
                throw new InvalidOperationException("pdftoppm produced no output image.");

            return await File.ReadAllBytesAsync(jpgPath, ct);
        }
        finally
        {
            try { Directory.Delete(workDir, recursive: true); }
            catch (Exception ex) { _logger.LogWarning(ex, "Failed to clean up temp dir {Dir}", workDir); }
        }
    }
}
