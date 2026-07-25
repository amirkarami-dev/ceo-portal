using Mabhas19.Application.Analytics.Reports;

namespace Mabhas19.Application.Common.Interfaces.Analytics;

/// <summary>Serialises a <see cref="ReportResultDto"/> into a downloadable byte stream (e.g. XLSX, CSV, PDF).</summary>
public interface IExportEngine
{
    Task<byte[]> ExportAsync(ReportResultDto result, string format, CancellationToken cancellationToken = default);
}
