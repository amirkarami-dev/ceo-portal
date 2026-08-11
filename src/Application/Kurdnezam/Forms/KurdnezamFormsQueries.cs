using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Application.Kurdnezam.Common;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Kurdnezam;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Kurdnezam.Forms;

/// <summary>Shared projection so the list, the single form and the news page never disagree.</summary>
internal static class KurdnezamFormProjection
{
    public static readonly System.Linq.Expressions.Expression<Func<KurdnezamForm, KurdnezamFormDto>> ToDto =
        f => new KurdnezamFormDto
        {
            Id = f.Id,
            Title = f.Title,
            Note = f.Note,
            Deadline = f.Deadline,
            Image = f.Image,
            IsOpen = f.IsOpen,
            SuccessMessage = f.SuccessMessage,
            SortOrder = f.SortOrder,
            SubmissionCount = f.Submissions.Count,
            Fields = f.Fields
                .OrderBy(x => x.SortOrder)
                .ThenBy(x => x.Id)
                .Select(x => new KurdnezamFormFieldDto
                {
                    Id = x.Id,
                    Label = x.Label,
                    Kind = x.Kind,
                    IsRequired = x.IsRequired,
                    AllowMultiple = x.AllowMultiple,
                    MaxLength = x.MaxLength,
                    Help = x.Help,
                    SortOrder = x.SortOrder
                })
                .ToList()
        };
}

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
            .Select(KurdnezamFormProjection.ToDto)
            .ToListAsync(cancellationToken);
}

/// <summary>A single form with its fields. Used by <c>/forms/{id}</c> and by a news page.</summary>
public record GetKurdnezamFormByIdQuery(int Id) : IRequest<KurdnezamFormDto>;

public class GetKurdnezamFormByIdQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamFormByIdQuery, KurdnezamFormDto>
{
    public async Task<KurdnezamFormDto> Handle(GetKurdnezamFormByIdQuery request, CancellationToken cancellationToken)
    {
        var dto = await context.KurdnezamForms
            .AsNoTracking()
            .Where(f => f.Id == request.Id)
            .Select(KurdnezamFormProjection.ToDto)
            .FirstOrDefaultAsync(cancellationToken);

        Guard.Against.NotFound(request.Id, dto);

        return dto;
    }
}

/// <summary>
/// Administrator inbox of submissions, newest first. Gated on the request as well as the route —
/// submissions carry the members' personal data, and now their files too.
/// </summary>
[Authorize(Roles = Roles.AdminOrSuper)]
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
                IsHandled = s.IsHandled,
                Created = s.Created,
                Answers = s.Answers
                    .OrderBy(a => a.Id)
                    .Select(a => new KurdnezamFormAnswerDto
                    {
                        FieldId = a.FieldId,
                        FieldLabel = a.FieldLabel,
                        Text = a.Text
                    })
                    .ToList(),
                Attachments = s.Attachments
                    .OrderBy(a => a.Id)
                    .Select(a => new KurdnezamFormAttachmentDto
                    {
                        Id = a.Id,
                        FieldId = a.FieldId,
                        FieldLabel = a.FieldLabel,
                        FileName = a.FileName,
                        ContentType = a.ContentType,
                        SizeBytes = a.SizeBytes
                    })
                    .ToList()
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

/// <summary>
/// The stored object behind one attachment, for the administrator download route. Returns the key
/// and the name to save it as; the endpoint streams it.
/// </summary>
[Authorize(Roles = Roles.AdminOrSuper)]
public record GetKurdnezamFormAttachmentQuery(int AttachmentId) : IRequest<KurdnezamFormAttachmentFile>;

/// <summary>Where an attachment lives, and what to call it when it is downloaded.</summary>
public sealed record KurdnezamFormAttachmentFile(string StoredKey, string FileName, string ContentType);

public class GetKurdnezamFormAttachmentQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetKurdnezamFormAttachmentQuery, KurdnezamFormAttachmentFile>
{
    public async Task<KurdnezamFormAttachmentFile> Handle(GetKurdnezamFormAttachmentQuery request, CancellationToken cancellationToken)
    {
        var file = await context.KurdnezamFormAttachments
            .AsNoTracking()
            .Where(a => a.Id == request.AttachmentId)
            .Select(a => new KurdnezamFormAttachmentFile(a.StoredKey, a.FileName, a.ContentType))
            .FirstOrDefaultAsync(cancellationToken);

        Guard.Against.NotFound(request.AttachmentId, file);

        return file;
    }
}
