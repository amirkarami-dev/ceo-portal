using Mabhas19.Application.Common.Interfaces.Analytics;
using Mabhas19.Application.Common.Security;

namespace Mabhas19.Application.Analytics.Reports.Queries.GetEngineerQuota;

/// <summary>
/// «وضعیت سهمیه ثبت شده مهندسان به تفکیک شهر و رشته» — quota consumption for one city and discipline.
/// </summary>
/// <remarks>
/// <para>
/// <c>[Authorize]</c> with no role, matching <c>ExecuteReportQuery</c>. That handler additionally
/// refuses models marked <c>RequiresAdministrator</c>, and this needs no such check: only the welfare
/// models carry that flag, the KurdNezam ones do not, and what comes back here is **aggregate** —
/// areas and counts per base, no name and no کد ملی. If that ever stops being true, the guard belongs
/// here, next to this comment.
/// </para>
/// </remarks>
[Authorize]
public record GetEngineerQuotaQuery(int CityId, int Reshte) : IRequest<EngineerQuotaDto>;

public class GetEngineerQuotaQueryHandler : IRequestHandler<GetEngineerQuotaQuery, EngineerQuotaDto>
{
    private readonly IEngineerQuotaReader _reader;

    public GetEngineerQuotaQueryHandler(IEngineerQuotaReader reader) => _reader = reader;

    public Task<EngineerQuotaDto> Handle(GetEngineerQuotaQuery request, CancellationToken cancellationToken)
        => _reader.GetAsync(request.CityId, request.Reshte, cancellationToken);
}
