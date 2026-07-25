using System.Text.Json;
using Mabhas19.Application.Common.Exceptions;
using Mabhas19.Application.Common.Interfaces;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;
using Mabhas19.Application.Common.Security;
using Mabhas19.Application.Reports;
using Mabhas19.Domain.Entities;
using Mabhas19.Domain.Services;

namespace Mabhas19.Application.Assessments.Commands.GenerateReport;

[Authorize]
public record GenerateReportCommand(int ProjectId) : IRequest<GenerateReportResult>;

public record GenerateReportResult(string DownloadUrl, string FileName);

public class GenerateReportCommandHandler : IRequestHandler<GenerateReportCommand, GenerateReportResult>
{
    private static readonly IReadOnlyDictionary<string, string> SectionTitles = new Dictionary<string, string>
    {
        ["env_opaque"] = "پوسته خارجی غیر نورگذر",
        ["env_trans"] = "پوسته خارجی نورگذر",
        ["mech"] = "تأسیسات مکانیکی",
        ["elec"] = "تأسیسات الکتریکی",
        ["monitoring"] = "سامانه پایش انرژی",
        ["integrated"] = "مدیریت یکپارچه انرژی"
    };

    private readonly IApplicationDbContext _context;
    private readonly IUser _user;
    private readonly IReportGenerator _reportGenerator;
    private readonly IFileStorage _storage;

    public GenerateReportCommandHandler(
        IApplicationDbContext context,
        IUser user,
        IReportGenerator reportGenerator,
        IFileStorage storage)
    {
        _context = context;
        _user = user;
        _reportGenerator = reportGenerator;
        _storage = storage;
    }

    public async Task<GenerateReportResult> Handle(GenerateReportCommand request, CancellationToken cancellationToken)
    {
        var project = await _context.Projects
            .Include(p => p.Assessment)
            .FirstOrDefaultAsync(p => p.Id == request.ProjectId, cancellationToken);

        Guard.Against.NotFound(request.ProjectId, project);

        if (project.OwnerId != _user.Id) throw new ForbiddenAccessException();

        if (project.Assessment is null)
        {
            var ex = new ValidationException();
            ex.Errors["Assessment"] = new[] { "هیچ ارزیابی برای این پروژه ثبت نشده است." };
            throw ex;
        }

        var assessment = project.Assessment;
        var climateLabel = ClimateData.Definitions.TryGetValue(project.ClimateCode, out var cl) ? cl : project.ClimateCode;

        var model = new AssessmentReportModel
        {
            ProjectTitle = project.Title,
            Client = project.Client,
            Address = project.Address,
            City = project.City,
            ClimateCode = project.ClimateCode,
            ClimateLabel = climateLabel,
            TotalArea = project.TotalArea,
            FloorCount = project.FloorCount,
            UnitCount = project.UnitCount,
            Usage = project.Usage,
            BuildingGroupLabel = BuildingGroupCalculator.PersianLabel(project.BuildingGroup),
            TotalScore = assessment.TotalScore,
            MaxScore = assessment.MaxScore,
            GeneratedAt = DateTimeOffset.UtcNow,
            Sections = ParseSections(assessment.ResultJson)
        };

        var pdf = _reportGenerator.GenerateAssessmentReport(model);

        var fileName = $"mabhas19-report-{project.Id}-{DateTime.UtcNow:yyyyMMddHHmmss}.pdf";
        var storageKey = $"reports/{project.OwnerId}/{fileName}";

        using (var ms = new MemoryStream(pdf))
        {
            await _storage.PutAsync(storageKey, ms, "application/pdf", cancellationToken);
        }

        assessment.Reports.Add(new AssessmentReport
        {
            AssessmentId = assessment.Id,
            StorageKey = storageKey,
            FileName = fileName,
            Size = pdf.Length
        });
        await _context.SaveChangesAsync(cancellationToken);

        var url = await _storage.GetPresignedUrlAsync(storageKey, TimeSpan.FromHours(1), cancellationToken);

        return new GenerateReportResult(url, fileName);
    }

    private static List<AssessmentReportModel.ReportSection> ParseSections(string resultJson)
    {
        var sections = new List<AssessmentReportModel.ReportSection>();
        if (string.IsNullOrWhiteSpace(resultJson)) return sections;

        try
        {
            using var doc = JsonDocument.Parse(resultJson);
            if (doc.RootElement.ValueKind != JsonValueKind.Object) return sections;

            foreach (var prop in doc.RootElement.EnumerateObject())
            {
                var key = prop.Name;
                var el = prop.Value;
                if (el.ValueKind != JsonValueKind.Object) continue;

                var score = GetInt(el, "score");
                var maxScore = GetInt(el, "maxScore");
                var title = el.TryGetProperty("title", out var t) && t.ValueKind == JsonValueKind.String
                    ? t.GetString()!
                    : SectionTitles.TryGetValue(key, out var st) ? st : key;

                sections.Add(new AssessmentReportModel.ReportSection(key, title, score, maxScore));
            }
        }
        catch (JsonException)
        {
            // Malformed result payload — return whatever parsed.
        }

        return sections;
    }

    private static int GetInt(JsonElement el, string name)
    {
        if (el.TryGetProperty(name, out var v))
        {
            if (v.ValueKind == JsonValueKind.Number && v.TryGetInt32(out var i)) return i;
            if (v.ValueKind == JsonValueKind.Number) return (int)Math.Round(v.GetDouble());
            if (v.ValueKind == JsonValueKind.String && int.TryParse(v.GetString(), out var s)) return s;
        }
        return 0;
    }
}
