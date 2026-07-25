using System.Diagnostics;
using System.Net;
using Mabhas19.Application.Common.Interfaces.MunSanandaj;
using Microsoft.Extensions.Logging;

namespace Mabhas19.Infrastructure.MunSanandaj;

/// <summary>
/// Downloads the pre-generated report PDF (named by Peygiri) and renders its first page to a JPG,
/// base64-encoded — because the municipality's saveEngineerReport endpoint expects an image
/// (<c>data:image/jpg;base64,…</c>), not a PDF. Rendering uses <c>pdftoppm</c> (poppler-utils),
/// installed in the API image.
/// </summary>
internal sealed class MunSanandajPdfFetcher : IMunSanandajPdfFetcher
{
    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(60) };
    private const int RenderDpi = 150;

    private readonly ILogger<MunSanandajPdfFetcher> _logger;

    public MunSanandajPdfFetcher(ILogger<MunSanandajPdfFetcher> logger)
    {
        _logger = logger;
    }

    public async Task<string?> FetchAsBase64Async(string peygiri, CancellationToken ct = default)
    {
        // The PDF file is named by the Peygiri (tracking code), not the ProjectNo.
        var url = $"https://eservice.kurdnezam.ir/sm/pdf/{peygiri}.pdf";
        using var response = await Http.GetAsync(url, ct);
        if (response.StatusCode == HttpStatusCode.NotFound) return null;
        response.EnsureSuccessStatusCode();
        var pdfBytes = await response.Content.ReadAsByteArrayAsync(ct);

        var jpgBytes = await RenderFirstPageToJpegAsync(pdfBytes, ct);
        return Convert.ToBase64String(jpgBytes);
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
