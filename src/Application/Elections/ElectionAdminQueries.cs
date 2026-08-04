using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Elections;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Elections;

public sealed record ElectionListItemDto(
    int Id,
    string Title,
    string DateJalali,
    TimeOnly StartTime,
    TimeOnly EndTime,
    ElectionStatus Status,
    ElectionPhase Phase,
    ElectionEligibility EligibilityMode,
    int MaxSelections,
    int CandidateCount,
    /// <summary>Human-readable eligibility, e.g. «ویژهٔ مهندسان رشتهٔ مکانیک». See the note below.</summary>
    string EligibilitySummary,
    /// <summary>How many ballots exist. A count only — never who cast them.</summary>
    int BallotCount);

public sealed record ElectionCandidateDto(
    int Id,
    string FullName,
    string? Description,
    string? ReshteCode,
    string? EducationLevel,
    string? Image,
    int SortOrder);

public sealed record ElectionDetailDto(
    int Id,
    string Title,
    string? Description,
    string DateJalali,
    TimeOnly StartTime,
    TimeOnly EndTime,
    ElectionStatus Status,
    ElectionPhase Phase,
    ElectionEligibility EligibilityMode,
    int MaxSelections,
    IReadOnlyList<EligibleReshteInput> EligibleReshtes,
    IReadOnlyList<ElectionCandidateDto> Candidates,
    string EligibilitySummary,
    int BallotCount,
    /// <summary>False once voting has opened or a ballot exists — the freeze rule.</summary>
    bool IsEditable);

/// <summary>
/// Turns a stored code set into words a voter can read.
/// </summary>
/// <remarks>
/// A published election has to explain who it is for, or an excluded voter just sees a refusal and
/// assumes the system is broken. Uses the label the admin saw; falls back to the bare code so a
/// missing label degrades to «رشتهٔ ۴» rather than to nothing.
/// </remarks>
internal static class EligibilityText
{
    public static string Describe(ElectionEligibility mode, IEnumerable<ElectionEligibleReshte> reshtes)
    {
        if (mode == ElectionEligibility.AllMembers)
        {
            return "همهٔ اعضای سازمان";
        }

        var names = reshtes
            .OrderBy(r => r.ReshteCode, StringComparer.Ordinal)
            .Select(r => string.IsNullOrWhiteSpace(r.ReshteLabel) ? $"رشتهٔ {r.ReshteCode}" : r.ReshteLabel!)
            .ToList();

        return names.Count == 0
            ? "هیچ رشته‌ای انتخاب نشده است"
            : $"ویژهٔ مهندسان {string.Join("، ", names)}";
    }
}

// ── list ─────────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record GetElectionsQuery : IRequest<IReadOnlyList<ElectionListItemDto>>;

public class GetElectionsQueryHandler(IApplicationDbContext context, TimeProvider clock)
    : IRequestHandler<GetElectionsQuery, IReadOnlyList<ElectionListItemDto>>
{
    public async Task<IReadOnlyList<ElectionListItemDto>> Handle(
        GetElectionsQuery request,
        CancellationToken cancellationToken)
    {
        var now = clock.GetUtcNow();

        var rows = await context.Elections
            .AsNoTracking()
            .Include(e => e.EligibleReshtes)
            .OrderByDescending(e => e.OpensAtUtc)
            .Select(e => new
            {
                Election = e,
                CandidateCount = e.Candidates.Count,
                // Counted, never listed. The roll is not readable from here by design.
                BallotCount = context.ElectionBallots.Count(b => b.ElectionId == e.Id)
            })
            .ToListAsync(cancellationToken);

        return rows.Select(r => new ElectionListItemDto(
                r.Election.Id,
                r.Election.Title,
                r.Election.DateJalali,
                r.Election.StartTime,
                r.Election.EndTime,
                r.Election.Status,
                r.Election.PhaseAt(now),
                r.Election.EligibilityMode,
                r.Election.MaxSelections,
                r.CandidateCount,
                EligibilityText.Describe(r.Election.EligibilityMode, r.Election.EligibleReshtes),
                r.BallotCount))
            .ToList();
    }
}

// ── detail ───────────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record GetElectionQuery(int Id) : IRequest<ElectionDetailDto>;

public class GetElectionQueryHandler(IApplicationDbContext context, TimeProvider clock)
    : IRequestHandler<GetElectionQuery, ElectionDetailDto>
{
    public async Task<ElectionDetailDto> Handle(GetElectionQuery request, CancellationToken cancellationToken)
    {
        var e = await context.Elections
            .AsNoTracking()
            .Include(x => x.Candidates)
            .Include(x => x.EligibleReshtes)
            .FirstOrDefaultAsync(x => x.Id == request.Id, cancellationToken);

        Guard.Against.NotFound(request.Id, e);

        var ballotCount = await context.ElectionBallots
            .CountAsync(b => b.ElectionId == e.Id, cancellationToken);

        var now = clock.GetUtcNow();

        return new ElectionDetailDto(
            e.Id,
            e.Title,
            e.Description,
            e.DateJalali,
            e.StartTime,
            e.EndTime,
            e.Status,
            e.PhaseAt(now),
            e.EligibilityMode,
            e.MaxSelections,
            e.EligibleReshtes
                .OrderBy(r => r.ReshteCode, StringComparer.Ordinal)
                .Select(r => new EligibleReshteInput(r.ReshteCode, r.ReshteLabel))
                .ToList(),
            e.Candidates
                .OrderBy(c => c.SortOrder)
                .Select(c => new ElectionCandidateDto(
                    c.Id, c.FullName, c.Description, c.ReshteCode, c.EducationLevel, c.Image, c.SortOrder))
                .ToList(),
            EligibilityText.Describe(e.EligibilityMode, e.EligibleReshtes),
            ballotCount,
            // Mirrors ElectionGuard.EnsureEditableAsync so the UI can disable the form instead of
            // letting the admin type into it and then be refused on save.
            e.Status == ElectionStatus.Draft || (now < e.OpensAtUtc && ballotCount == 0));
    }
}
