using Mabhas19.Domain.Constants;
using Mabhas19.Infrastructure.Data;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Mabhas19.Application.FunctionalTests.Infrastructure;

public static class TestApp
{
    private static string? _userId;
    private static string? _userName;
    private static List<string>? _roles;

    public static async Task<TResponse> SendAsync<TResponse>(IRequest<TResponse> request)
    {
        using var scope = FunctionalTestSetup.ScopeFactory.CreateScope();

        var mediator = scope.ServiceProvider.GetRequiredService<ISender>();

        return await mediator.Send(request);
    }

    public static async Task SendAsync(IBaseRequest request)
    {
        using var scope = FunctionalTestSetup.ScopeFactory.CreateScope();

        var mediator = scope.ServiceProvider.GetRequiredService<ISender>();

        await mediator.Send(request);
    }

    public static string? GetUserId() => _userId;

    public static string? GetUserName() => _userName;

    public static List<string>? GetRoles() => _roles;

    /// <summary>
    /// Sign in as an engineer: the username IS the کد ملی, which is what the vote path reads.
    /// </summary>
    /// <remarks>
    /// The subject is a fresh GUID each time, on purpose. The ballot must be unlinkable from the OIDC
    /// subject, so a test that reused one would not notice if the roll ever started keying on it.
    /// </remarks>
    public static string RunAsEngineerAsync(string nationalCode, params string[] roles)
    {
        _userId = Guid.NewGuid().ToString();
        _userName = nationalCode;
        _roles = [.. roles];
        return _userId;
    }

    /// <summary>
    /// Drops the identity without touching the database.
    /// </summary>
    /// <remarks>
    /// For the anonymous half of a link test. <see cref="ResetState"/> would also do it — and would
    /// wipe the room the test just seeded, so the link would come back "not found" for a reason that
    /// has nothing to do with what was being proven.
    /// </remarks>
    public static void SignOut()
    {
        _userId = null;
        _userName = null;
        _roles = null;
    }

    public static async Task<string> RunAsDefaultUserAsync()
    {
        return await RunAsUserAsync("test@local", "Testing1234!", []);
    }

    public static async Task<string> RunAsAdministratorAsync()
    {
        return await RunAsUserAsync("administrator@local", "Administrator1234!", [Roles.Administrator]);
    }

    public static Task<string> RunAsUserAsync(string userName, string password, string[] roles)
    {
        // Identity lives in the central OIDC IdP; the API is a pure JWT resource server and
        // authorises purely from claims (see CurrentUser / IUser). Tests therefore just assert
        // an identity — a GUID subject plus roles — that the test IUser (WebApiFactory) surfaces.
        _userId = Guid.NewGuid().ToString();
        _roles = [.. roles];
        return Task.FromResult(_userId);
    }

    public static async Task ResetState()
    {
        if (FunctionalTestSetup.DbResetter is not null)
        {
            await FunctionalTestSetup.DbResetter.ResetAsync();
        }

        _userId = null;
        _userName = null;
        _roles = null;

        // These are singletons across the whole run, so leaked engineers, captured messages or a leaked
        // outage flag would silently change the next test.
        FunctionalTestSetup.Directory.Reset();
        FunctionalTestSetup.Bale.Reset();
        FunctionalTestSetup.OtpSender.Reset();
        FunctionalTestSetup.Otp?.Reset();
        FunctionalTestSetup.LiveKit.Reset();
    }

    public static async Task<TEntity?> FindAsync<TEntity>(params object[] keyValues)
        where TEntity : class
    {
        using var scope = FunctionalTestSetup.ScopeFactory.CreateScope();

        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        return await context.FindAsync<TEntity>(keyValues);
    }

    public static async Task AddAsync<TEntity>(TEntity entity)
        where TEntity : class
    {
        using var scope = FunctionalTestSetup.ScopeFactory.CreateScope();

        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        context.Add(entity);

        await context.SaveChangesAsync();
    }

    public static async Task<int> CountAsync<TEntity>() where TEntity : class
    {
        using var scope = FunctionalTestSetup.ScopeFactory.CreateScope();

        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        return await context.Set<TEntity>().CountAsync();
    }

    /// <summary>
    /// The most recent OTP the bot issued.
    /// </summary>
    /// <remarks>
    /// Only a test can read this. The real store generates a cryptographically random code and never
    /// exposes it — which is correct, and is why the recorder in <c>WebApiFactory</c> exists.
    /// </remarks>
    public static string LastOtp() =>
        FunctionalTestSetup.Otp?.LastCode
        ?? throw new InvalidOperationException("No OTP has been issued.");

    /// <summary>Candidate ids for an election, in ballot order, as a voter would see them.</summary>
    public static async Task<List<int>> CandidateIdsAsync(int electionId)
    {
        using var scope = FunctionalTestSetup.ScopeFactory.CreateScope();

        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        return await context.ElectionCandidates
            .AsNoTracking()
            .Where(c => c.ElectionId == electionId)
            .OrderBy(c => c.SortOrder)
            .Select(c => c.Id)
            .ToListAsync();
    }

    /// <summary>Every row of a table, for asserting on what was actually stored.</summary>
    public static async Task<List<TEntity>> AllAsync<TEntity>() where TEntity : class
    {
        using var scope = FunctionalTestSetup.ScopeFactory.CreateScope();

        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        return await context.Set<TEntity>().AsNoTracking().ToListAsync();
    }

    /// <summary>
    /// Changes an entity directly, for arranging states no command will produce.
    /// </summary>
    /// <remarks>
    /// Used to un-publish an election or move its window into the past. Going through the real commands
    /// is preferred everywhere else, but there is deliberately no command that back-dates a window —
    /// adding one just for tests would put a way to reopen a closed election into production code.
    /// </remarks>
    public static async Task MutateAsync<TEntity>(Action<TEntity> change, params object[] keyValues)
        where TEntity : class
    {
        using var scope = FunctionalTestSetup.ScopeFactory.CreateScope();

        var context = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();

        var entity = await context.FindAsync<TEntity>(keyValues)
                     ?? throw new InvalidOperationException($"{typeof(TEntity).Name} not found.");

        change(entity);
        await context.SaveChangesAsync();
    }
}
