using Mabhas19.Application.Common.Interfaces;

namespace Mabhas19.Application.FunctionalTests.Infrastructure;

/// <summary>
/// An in-memory stand-in for the organisation's membership database.
/// </summary>
/// <remarks>
/// <para>
/// The real <c>KurdNezamDirectory</c> reads the org's production SQL Server over the network. Tests
/// must not touch it: it is someone else's live database, the connection string is a production
/// secret, and a test that depends on real membership rows would fail whenever a real engineer's
/// record changed.
/// </para>
/// <para>
/// It can also be told to be <b>unavailable</b>, which is the case that matters most. `GOTCHAS.md`
/// records «این کد ملی یافت نشد» once being shown for what was really a database fault; during an
/// election that wording would tell every voter they are not a member.
/// </para>
/// </remarks>
public sealed class FakeEngineerDirectory : IEngineerDirectory
{
    private readonly Dictionary<string, EngineerInfo> _people = new(StringComparer.Ordinal);

    /// <summary>When true every lookup reports <see cref="DirectoryOutcome.Unavailable"/>.</summary>
    public bool IsUnavailable { get; set; }

    public bool IsConfigured { get; set; } = true;

    public void Reset()
    {
        _people.Clear();
        IsUnavailable = false;
        IsConfigured = true;
    }

    public void Add(EngineerInfo engineer) => _people[engineer.NationalCode] = engineer;

    public Task<EngineerInfo?> GetByNationalCodeAsync(string nationalCode, CancellationToken ct = default)
        => Task.FromResult(IsUnavailable ? null : _people.GetValueOrDefault(nationalCode));

    public Task<DirectoryResult> LookupAsync(string nationalCode, CancellationToken ct = default)
    {
        if (IsUnavailable)
        {
            return Task.FromResult(new DirectoryResult(DirectoryOutcome.Unavailable, null));
        }

        return Task.FromResult(_people.TryGetValue(nationalCode, out var engineer)
            ? new DirectoryResult(DirectoryOutcome.Found, engineer)
            : new DirectoryResult(DirectoryOutcome.NotFound, null));
    }
}
