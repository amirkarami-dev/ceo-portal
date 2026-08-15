namespace Mabhas19.Application.Analytics.Reports.Queries.GetEngineerQuota;

public class GetEngineerQuotaQueryValidator : AbstractValidator<GetEngineerQuotaQuery>
{
    /// <summary>
    /// Both ids reach a stored procedure. They travel as typed <c>int</c> SQL parameters, so this is
    /// not what stops an injection — it is what stops a malformed request becoming a pointless call
    /// to the warehouse.
    ///
    /// The bounds are deliberately loose rather than an allow-list of the nine cities and seven
    /// disciplines that exist today. Those ids live in the database; hard-coding them here would mean
    /// a new city returns 400 from a service that is not the one that knows about cities.
    /// </summary>
    public GetEngineerQuotaQueryValidator()
    {
        RuleFor(x => x.CityId).GreaterThan(0);
        RuleFor(x => x.Reshte).GreaterThan(0);
    }
}
