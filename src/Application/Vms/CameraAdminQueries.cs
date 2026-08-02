using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Vms;

public sealed record VmsCityDto(string Code, string Name, int DisplayOrder, bool IsActive, int CameraCount);

public sealed record CameraListItemDto(
    int Id,
    string Name,
    string CityCode,
    string CityName,
    string Host,
    int RtspPort,
    string StreamKey,
    int Channel,
    int SubStreamId,
    int? MainStreamId,
    bool IsActive,
    /// <summary>
    /// When the scheduled sweep last reached this camera. Null means it has never been checked —
    /// which is not the same as "offline", and the UI has to say so differently.
    /// </summary>
    DateTimeOffset? LastSeenUtc);

public sealed record CameraDetailDto(
    int Id,
    string Name,
    string CityCode,
    string CityName,
    string Host,
    int RtspPort,
    string StreamKey,
    string CredentialKey,
    int Channel,
    int SubStreamId,
    int? MainStreamId,
    bool IsActive,
    DateTimeOffset? LastSeenUtc,
    string? Notes);

/// <summary>
/// Every camera, newest city order first, optionally narrowed to one city.
/// </summary>
/// <remarks>
/// Soft-deleted cameras are never returned. They exist only so a stream key is never reused.
/// </remarks>
[Authorize(Roles = Roles.Administrator)]
public record GetCamerasQuery(string? CityCode = null) : IRequest<IReadOnlyList<CameraListItemDto>>;

public class GetCamerasQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetCamerasQuery, IReadOnlyList<CameraListItemDto>>
{
    public async Task<IReadOnlyList<CameraListItemDto>> Handle(
        GetCamerasQuery request, CancellationToken cancellationToken)
    {
        var query = context.VmsCameras.Where(x => !x.IsDeleted);

        if (!string.IsNullOrWhiteSpace(request.CityCode))
        {
            var code = request.CityCode.Trim();
            query = query.Where(x => x.CityCode == code);
        }

        return await query
            .OrderBy(x => x.City!.DisplayOrder)
            .ThenBy(x => x.Name)
            .Select(x => new CameraListItemDto(
                x.Id,
                x.Name,
                x.CityCode,
                x.City!.Name,
                x.Host,
                x.RtspPort,
                x.StreamKey,
                x.Channel,
                x.SubStreamId,
                x.MainStreamId,
                x.IsActive,
                x.LastSeenUtc))
            .ToListAsync(cancellationToken);
    }
}

[Authorize(Roles = Roles.Administrator)]
public record GetCameraQuery(int Id) : IRequest<CameraDetailDto>;

public class GetCameraQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetCameraQuery, CameraDetailDto>
{
    public async Task<CameraDetailDto> Handle(GetCameraQuery request, CancellationToken cancellationToken)
    {
        var dto = await context.VmsCameras
            .Where(x => x.Id == request.Id && !x.IsDeleted)
            .Select(x => new CameraDetailDto(
                x.Id,
                x.Name,
                x.CityCode,
                x.City!.Name,
                x.Host,
                x.RtspPort,
                x.StreamKey,
                x.CredentialKey,
                x.Channel,
                x.SubStreamId,
                x.MainStreamId,
                x.IsActive,
                x.LastSeenUtc,
                x.Notes))
            .FirstOrDefaultAsync(cancellationToken);

        Guard.Against.NotFound(request.Id, dto);

        return dto;
    }
}

/// <summary>
/// The cities, with how many live cameras each holds.
/// </summary>
/// <remarks>
/// The count is what lets the admin panel grey out an empty city rather than opening an empty grid,
/// and it is what makes deleting a city obviously refusable before the attempt.
/// </remarks>
[Authorize(Roles = Roles.Administrator)]
public record GetVmsCitiesQuery(bool IncludeInactive = false) : IRequest<IReadOnlyList<VmsCityDto>>;

public class GetVmsCitiesQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetVmsCitiesQuery, IReadOnlyList<VmsCityDto>>
{
    public async Task<IReadOnlyList<VmsCityDto>> Handle(
        GetVmsCitiesQuery request, CancellationToken cancellationToken)
    {
        var query = context.VmsCities.AsQueryable();

        if (!request.IncludeInactive)
        {
            query = query.Where(x => x.IsActive);
        }

        return await query
            .OrderBy(x => x.DisplayOrder)
            .ThenBy(x => x.Name)
            .Select(x => new VmsCityDto(
                x.Code,
                x.Name,
                x.DisplayOrder,
                x.IsActive,
                x.Cameras.Count(c => !c.IsDeleted)))
            .ToListAsync(cancellationToken);
    }
}
