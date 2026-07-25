using Mabhas19.Application.Common.Interfaces.MunSanandaj;
using Mabhas19.Domain.MunSanandaj;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.MunSanandaj;

/// <summary>Runs the saveEngMap sync every MunSanandaj:IntervalHours (default 12h).</summary>
internal sealed class SaveEngMapWorker : BackgroundService
{
    private readonly IServiceScopeFactory _scopeFactory;
    private readonly MunSanandajOptions _options;
    private readonly ILogger<SaveEngMapWorker> _logger;

    public SaveEngMapWorker(IServiceScopeFactory scopeFactory, IOptions<MunSanandajOptions> options, ILogger<SaveEngMapWorker> logger)
    {
        _scopeFactory = scopeFactory;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromHours(_options.IntervalHours));
        do
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var syncService = scope.ServiceProvider.GetRequiredService<IMunSanandajSyncService>();
                await syncService.RunSaveEngMapAsync(MunRunTrigger.Timer, triggeredByUser: null, stoppingToken);
            }
            catch (Exception ex) when (!stoppingToken.IsCancellationRequested)
            {
                _logger.LogError(ex, "SaveEngMapWorker tick failed");
            }
        } while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
