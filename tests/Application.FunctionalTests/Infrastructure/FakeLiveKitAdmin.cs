using System.Collections.Concurrent;
using Mabhas19.Application.Common.Interfaces.Rooms;

namespace Mabhas19.Application.FunctionalTests.Infrastructure;

/// <summary>
/// Stands in for the media server's admin API.
/// </summary>
/// <remarks>
/// <para>
/// Registered for every functional test, not only the room ones. The real client points at
/// <c>lk.myceo.ir</c> with an eight-second timeout and is fail-soft, so leaving it in place would not
/// fail a test — it would make the meeting list take eight seconds to return zeros, and hide a missing
/// call behind a timeout that looks the same as a call that never happened.
/// </para>
/// <para>
/// So this records instead: <see cref="EndedRooms"/> is how a test proves that deactivating a meeting
/// also emptied it, which is the difference between a switch that works and one that only looks like
/// it does.
/// </para>
/// </remarks>
public sealed class FakeLiveKitAdmin : ILiveKitAdmin
{
    private readonly ConcurrentDictionary<string, int> _counts = new(StringComparer.Ordinal);
    private readonly ConcurrentBag<string> _ended = [];
    private readonly ConcurrentBag<(string Slug, string Identity)> _removed = [];

    public IReadOnlyCollection<string> EndedRooms => [.. _ended];

    public IReadOnlyCollection<(string Slug, string Identity)> RemovedParticipants => [.. _removed];

    public bool IsConfigured { get; set; } = true;

    /// <summary>Pretends N people are inside a room, so a list can be asserted on.</summary>
    public void SetLiveCount(string slug, int count) => _counts[slug] = count;

    public Task EnsureRoomAsync(string slug, int maxParticipants, CancellationToken cancellationToken = default)
    {
        _counts.TryAdd(slug, 0);
        return Task.CompletedTask;
    }

    public Task<int> LiveCountAsync(string slug, CancellationToken cancellationToken = default)
        => Task.FromResult(_counts.TryGetValue(slug, out var n) ? n : 0);

    public Task<IReadOnlyDictionary<string, int>> LiveCountsAsync(
        IEnumerable<string> slugs,
        CancellationToken cancellationToken = default)
    {
        IReadOnlyDictionary<string, int> result = slugs
            .Distinct(StringComparer.Ordinal)
            .ToDictionary(s => s, s => _counts.TryGetValue(s, out var n) ? n : 0, StringComparer.Ordinal);

        return Task.FromResult(result);
    }

    public Task EndRoomAsync(string slug, CancellationToken cancellationToken = default)
    {
        _ended.Add(slug);
        _counts[slug] = 0;
        return Task.CompletedTask;
    }

    public Task RemoveParticipantAsync(
        string slug, string identity, CancellationToken cancellationToken = default)
    {
        _removed.Add((slug, identity));
        return Task.CompletedTask;
    }

    public void Reset()
    {
        _counts.Clear();
        _ended.Clear();
        _removed.Clear();
        IsConfigured = true;
    }
}
