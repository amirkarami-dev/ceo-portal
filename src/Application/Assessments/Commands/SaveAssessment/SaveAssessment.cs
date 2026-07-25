using System.Text.Json.Nodes;
using Mabhas19.Application.Common.Exceptions;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Entities;
using Mabhas19.Domain.Enums;

namespace Mabhas19.Application.Assessments.Commands.SaveAssessment;

[Authorize]
public record SaveAssessmentCommand : IRequest
{
    public int ProjectId { get; init; }
    public string InputJson { get; init; } = "{}";
    public string ResultJson { get; init; } = "{}";
    public int TotalScore { get; init; }
    public int MaxScore { get; init; }
}

public class SaveAssessmentCommandHandler : IRequestHandler<SaveAssessmentCommand>
{
    // Section key -> the checklist tool keys it owns. Mirrors the frontend ASSESSMENT_SECTIONS
    // so server-side edit-gating agrees with the UI.
    private static readonly IReadOnlyDictionary<string, string[]> SectionTools =
        new Dictionary<string, string[]>(StringComparer.OrdinalIgnoreCase)
        {
            ["env"] = ["env_opaque.html", "env_trans.html"],
            ["mech"] = ["mech_checklist.html"],
            ["elec"] = ["elec_checklist.html"],
            ["mon"] = ["monitoring_checklist.html"],
            ["bms"] = ["integrated_mgmt.html"],
        };

    private readonly IApplicationDbContext _context;
    private readonly IUser _user;

    public SaveAssessmentCommandHandler(IApplicationDbContext context, IUser user)
    {
        _context = context;
        _user = user;
    }

    public async Task Handle(SaveAssessmentCommand request, CancellationToken cancellationToken)
    {
        var project = await _context.Projects
            .Include(p => p.Assessment)
            .FirstOrDefaultAsync(p => p.Id == request.ProjectId, cancellationToken);

        Guard.Against.NotFound(request.ProjectId, project);

        if (project.OwnerId != _user.Id) throw new ForbiddenAccessException();

        // Enforce per-section edit gating SERVER-SIDE. When the project restricts editable
        // sections (FarsNezam typ list), tool results outside those sections cannot be changed —
        // their previously stored value is preserved regardless of what the client sends.
        var allowedTools = ResolveAllowedTools(project.AllowedSections);

        var mergedInput = MergeByAllowedTools(project.Assessment?.InputJson, request.InputJson, allowedTools);
        var mergedResult = MergeByAllowedTools(project.Assessment?.ResultJson, request.ResultJson, allowedTools);
        var totalScore = SumScores(mergedResult); // recomputed server-side (don't trust the client total)
        var status = totalScore > 0 ? AssessmentStatus.Completed : AssessmentStatus.Draft;

        if (project.Assessment is null)
        {
            project.Assessment = new Assessment
            {
                ProjectId = project.Id,
                InputJson = mergedInput,
                ResultJson = mergedResult,
                TotalScore = totalScore,
                MaxScore = request.MaxScore,
                Status = status
            };
            _context.Assessments.Add(project.Assessment);
        }
        else
        {
            project.Assessment.InputJson = mergedInput;
            project.Assessment.ResultJson = mergedResult;
            project.Assessment.TotalScore = totalScore;
            project.Assessment.MaxScore = request.MaxScore;
            project.Assessment.Status = status;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Resolve the editable tool keys; null = unrestricted (every tool editable).</summary>
    private static HashSet<string>? ResolveAllowedTools(string? allowedSections)
    {
        if (string.IsNullOrWhiteSpace(allowedSections)) return null;
        var set = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var key in allowedSections.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (SectionTools.TryGetValue(key, out var tools))
            {
                foreach (var t in tools) set.Add(t);
            }
        }
        return set;
    }

    /// <summary>
    /// Merge two toolKey-keyed JSON objects: allowed tools take the incoming value; disallowed
    /// tools keep their existing stored value. When unrestricted, the incoming object is used as-is.
    /// </summary>
    private static string MergeByAllowedTools(string? existingJson, string? incomingJson, HashSet<string>? allowedTools)
    {
        var incoming = ParseObject(incomingJson);
        if (allowedTools is null) return incoming.ToJsonString();

        var existing = ParseObject(existingJson);
        var merged = new JsonObject();
        foreach (var kv in existing)
        {
            if (!allowedTools.Contains(kv.Key)) merged[kv.Key] = kv.Value?.DeepClone();
        }
        foreach (var kv in incoming)
        {
            if (allowedTools.Contains(kv.Key)) merged[kv.Key] = kv.Value?.DeepClone();
        }
        return merged.ToJsonString();
    }

    private static int SumScores(string resultJson)
    {
        var total = 0;
        foreach (var kv in ParseObject(resultJson))
        {
            if (kv.Value is JsonObject o &&
                o.TryGetPropertyValue("score", out var s) && s is not null &&
                int.TryParse(s.ToString(), out var n))
            {
                total += n;
            }
        }
        return total;
    }

    private static JsonObject ParseObject(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new JsonObject();
        try { return JsonNode.Parse(json) as JsonObject ?? new JsonObject(); }
        catch { return new JsonObject(); }
    }
}
