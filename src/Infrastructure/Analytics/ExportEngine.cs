using Mabhas19.Application.Analytics.Reports;
using Mabhas19.Application.Common.Interfaces.Analytics;

namespace Mabhas19.Infrastructure.Analytics;

/// <summary>
/// Stub export engine.
/// TODO(v2): render <see cref="ReportResultDto"/> as XLSX (ClosedXML), CSV, or PDF (QuestPDF)
/// based on the requested <paramref name="format"/>.
/// </summary>
internal sealed class ExportEngine : IExportEngine
{
    public Task<byte[]> ExportAsync(ReportResultDto result, string format, CancellationToken cancellationToken = default)
        => throw new NotImplementedException("v2");
}
