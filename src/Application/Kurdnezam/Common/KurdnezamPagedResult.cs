namespace Mabhas19.Application.Kurdnezam.Common;

/// <summary>
/// A page of results. The kurdnezam site previously filtered, searched, and sliced the entire
/// content array in the browser; paging now happens in SQL.
/// </summary>
public sealed class KurdnezamPagedResult<T>
{
    public IReadOnlyList<T> Items { get; init; } = [];

    public int Total { get; init; }

    public int Page { get; init; }

    public int PageSize { get; init; }

    public int TotalPages => PageSize <= 0 ? 0 : (int)Math.Ceiling(Total / (double)PageSize);
}
