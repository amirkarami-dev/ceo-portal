namespace Mabhas19.Application.Common.Interfaces.MunSanandaj;

/// <summary>Fetches the pre-generated supervising-engineer PDF (named by Peygiri) and base64-encodes it.</summary>
public interface IMunSanandajPdfFetcher
{
    /// <summary>
    /// Downloads <c>https://eservice.kurdnezam.ir/sm/pdf/{peygiri}.pdf</c> (the file is named by the
    /// Peygiri tracking code, not ProjectNo). Returns null (not an exception) when the PDF hasn't been
    /// generated yet (HTTP 404) — the caller logs this attempt as Failed and retries on the next run.
    /// </summary>
    Task<string?> FetchAsBase64Async(string peygiri, CancellationToken ct = default);
}
