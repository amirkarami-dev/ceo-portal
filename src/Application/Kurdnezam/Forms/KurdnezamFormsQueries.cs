using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Application.Kurdnezam.Common;
using Mabhas19.Domain.Constants;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.Forms;

/// <summary>Public list of forms, in the order the site renders them.</summary>
public record GetKurdnezamFormsQuery : IRequest<IReadOnlyList<KurdnezamFormDto>>;

public class GetKurdnezamFormsQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamFormsQuery, IReadOnlyList<KurdnezamFormDto>>
{
    public async Task<IReadOnlyList<KurdnezamFormDto>> Handle(GetKurdnezamFormsQuery request, CancellationToken cancellationToken)
        => await context.KurdnezamForms
            .AsNoTracking()
            .OrderBy(f => f.SortOrder)
            .ThenBy(f => f.Id)
            .Select(f => new KurdnezamFormDto
            {
                Id = f.Id,
                Title = f.Title,
                Note = f.Note,
                Deadline = f.Deadline,
                Image = f.Image,
                IsOpen = f.IsOpen,
                SortOrder = f.SortOrder,
                SubmissionCount = f.Submissions.Count
            })
            .ToListAsync(cancellationToken);
}

/// <summary>A single form. Used by <c>/forms/{id}</c>.</summary>
public record GetKurdnezamFormByIdQuery(int Id) : IRequest<KurdnezamFormDto>;

public class GetKurdnezamFormByIdQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamFormByIdQuery, KurdnezamFormDto>
{
    public async Task<KurdnezamFormDto> Handle(GetKurdnezamFormByIdQuery request, CancellationToken cancellationToken)
    {
        var dto = await context.KurdnezamForms
            .AsNoTracking()
            .Where(f => f.Id == request.Id)
            .Select(f => new KurdnezamFormDto
            {
                Id = f.Id,
                Title = f.Title,
                Note = f.Note,
                Deadline = f.Deadline,
                Image = f.Image,
                IsOpen = f.IsOpen,
                SortOrder = f.SortOrder,
                SubmissionCount = f.Submissions.Count
            })
            .FirstOrDefaultAsync(cancellationToken);

        Guard.Against.NotFound(request.Id, dto);

        return dto;
    }
}

/// <summary>
/// Administrator inbox of submissions, newest first. Gated on the request as well as the route —
/// submissions carry the members' personal data.
/// </summary>
[Authorize(Roles = Roles.Administrator)]
public record GetKurdnezamFormSubmissionsQuery(
    int? FormId = null,
    bool? Handled = null,
    int Page = 1,
    int PageSize = 20) : IRequest<KurdnezamPagedResult<KurdnezamFormSubmissionDto>>;

public class GetKurdnezamFormSubmissionsQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamFormSubmissionsQuery, KurdnezamPagedResult<KurdnezamFormSubmissionDto>>
{
    public async Task<KurdnezamPagedResult<KurdnezamFormSubmissionDto>> Handle(GetKurdnezamFormSubmissionsQuery request, CancellationToken cancellationToken)
    {
        var page = Math.Max(1, request.Page);
        var pageSize = Math.Clamp(request.PageSize, 1, 100);

        var query = context.KurdnezamFormSubmissions.AsNoTracking().AsQueryable();

        if (request.FormId is { } formId)
            query = query.Where(s => s.FormId == formId);

        if (request.Handled is { } handled)
            query = query.Where(s => s.IsHandled == handled);

        var total = await query.CountAsync(cancellationToken);

        var items = await query
            .OrderByDescending(s => s.Created)
            .ThenByDescending(s => s.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new KurdnezamFormSubmissionDto
            {
                Id = s.Id,
                FormId = s.FormId,
                FormTitle = s.Form!.Title,
                FullName = s.FullName,
                NationalId = s.NationalId,
                MembershipNo = s.MembershipNo,
                Mobile = s.Mobile,
                Notes = s.Notes,
                IsHandled = s.IsHandled,
                Created = s.Created
            })
            .ToListAsync(cancellationToken);

        return new KurdnezamPagedResult<KurdnezamFormSubmissionDto>
        {
            Items = items,
            Total = total,
            Page = page,
            PageSize = pageSize
        };
    }
}
