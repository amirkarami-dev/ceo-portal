using Mabhas19.Application.Reports;

namespace Mabhas19.Application.Common.Interfaces;

/// <summary>Renders a Section 19 assessment report to PDF bytes.</summary>
public interface IReportGenerator
{
    byte[] GenerateAssessmentReport(AssessmentReportModel model);
}
