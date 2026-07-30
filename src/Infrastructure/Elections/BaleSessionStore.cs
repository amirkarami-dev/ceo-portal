using Mabhas19.Application.Common.Interfaces.Elections;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.Elections;

/// <inheritdoc cref="IBaleSessionStore"/>
/// <remarks>
/// See <see cref="IBaleSessionStore"/> for why this is memory and not a table. Two properties matter
/// here: the entry expires on <b>inactivity</b> (so a کد ملی does not sit in memory after someone walks
/// away), and the size is bounded so a flood of chat ids cannot exhaust the process.
/// </remarks>
internal sealed class BaleSessionStore : IBaleSessionStore
{
    /// <summary>
    /// A private cache, not the shared <c>IMemoryCache</c>.
    /// </summary>
    /// <remarks>
    /// Its own instance so a size limit can be set without capping everything else in the process, and so
    /// nothing outside this class can enumerate or evict sessions holding a کد ملی.
    /// </remarks>
    private readonly MemoryCache _cache;

    private readonly TimeSpan _idle;

    public BaleSessionStore(IOptions<BaleOptions> options)
    {
        var minutes = options.Value.SessionIdleMinutes;

        // A zero or negative value from a bad config would expire sessions instantly and make the bot
        // silently unusable; clamp instead.
        _idle = TimeSpan.FromMinutes(Math.Clamp(minutes, 1, 120));

        _cache = new MemoryCache(new MemoryCacheOptions
        {
            // ~10k concurrent conversations. Far above any real election, and a hard ceiling means a
            // flood of fabricated chat ids costs memory that is reclaimed rather than growing forever.
            SizeLimit = 10_000
        });
    }

    public Task<BaleSession> GetAsync(long chatId, CancellationToken cancellationToken)
    {
        if (_cache.TryGetValue<BaleSession>(Key(chatId), out var existing) && existing is not null)
        {
            return Task.FromResult(existing);
        }

        // A brand-new session is NOT stored yet. Storing on read would let anyone who can reach the
        // webhook fill the cache by sending updates with fabricated chat ids, without ever completing a
        // step that a rate limit applies to.
        return Task.FromResult(new BaleSession { ChatId = chatId });
    }

    public Task SaveAsync(BaleSession session, CancellationToken cancellationToken)
    {
        _cache.Set(Key(session.ChatId), session, new MemoryCacheEntryOptions
        {
            // Sliding, not absolute: the window is about someone walking away mid-conversation, and
            // being cut off halfway through choosing candidates is worse than a slightly longer life.
            SlidingExpiration = _idle,
            Size = 1
        });

        return Task.CompletedTask;
    }

    public Task ClearAsync(long chatId, CancellationToken cancellationToken)
    {
        // Removing the entry is what actually forgets the کد ملی. /start calls this, so a shared device
        // cannot leave the previous person's identity live.
        _cache.Remove(Key(chatId));
        return Task.CompletedTask;
    }

    private static string Key(long chatId) => $"bale-session:{chatId}";
}
