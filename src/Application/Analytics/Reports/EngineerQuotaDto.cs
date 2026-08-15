namespace Mabhas19.Application.Analytics.Reports;

/// <summary>
/// One row from <c>[dbo].[F_ShowQuataInCity]</c>: registered design and supervision area, and the
/// engineer count, for each of the four bases in one city and discipline.
/// </summary>
/// <remarks>
/// <para>
/// The dimension lives in the <b>column names</b> — <c>_4</c>, <c>_1</c>, <c>_2</c>, <c>_3</c> for
/// پایه ارشد, یک, دو and سه. That is exactly why this cannot be an ordinary report: the analytics
/// engine builds <c>SELECT … GROUP BY</c> over rows × dimensions × measures, and there is nothing
/// here to group by. See <c>docs/design/2026-08-15-custom-reports-engineer-quota.md</c>.
/// </para>
/// <para>
/// The property names match the procedure's columns deliberately. ASP.NET serialises them
/// camel-cased — <c>UsedInTarahi_4</c> becomes <c>usedInTarahi_4</c> — which is the contract
/// <c>analytics-web</c>'s <c>QuotaRow</c> already expects.
/// </para>
/// <para>
/// <b>No capacities here.</b> The four totals (20 000 / 160 000 / 72 000 / 48 000) are a fixed
/// business rule held as a client constant. Returning them as well would create a second source of
/// truth for a number that must not vary by city or discipline.
/// </para>
/// </remarks>
public class EngineerQuotaDto
{
    // پایه ارشد
    public decimal UsedInTarahi_4 { get; init; }
    public decimal UsedInNezart_4 { get; init; }
    public int CntEngin_4 { get; init; }

    // پایه یک
    public decimal UsedInTarahi_1 { get; init; }
    public decimal UsedInNezart_1 { get; init; }
    public int CntEngin_1 { get; init; }

    // پایه دو
    public decimal UsedInTarahi_2 { get; init; }
    public decimal UsedInNezart_2 { get; init; }
    public int CntEngin_2 { get; init; }

    // پایه سه
    public decimal UsedInTarahi_3 { get; init; }
    public decimal UsedInNezart_3 { get; init; }
    public int CntEngin_3 { get; init; }
}
