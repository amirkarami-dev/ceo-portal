using Mabhas19.Application.Common.Interfaces.Analytics;
using Mabhas19.Infrastructure.Analytics.Ai;
using Mabhas19.Infrastructure.Analytics.Query;
using Mabhas19.Infrastructure.Analytics.Sql;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace Mabhas19.Infrastructure.Analytics;

internal static class AnalyticsServiceCollectionExtensions
{
    public static IServiceCollection AddAnalyticsServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Bind ArvanCloud AI gateway options (BaseUrl/ApiKey must come from user-secrets / env / SOPS).
        services.Configure<ArvanAiOptions>(configuration.GetSection(ArvanAiOptions.SectionName));

        // ── SQL analytics path (config-gated) ────────────────────────────────
        // If ConnectionStrings:AnalyticsDb is non-empty → register FarsNezam SQL engine.
        // Otherwise keep the bundled in-memory sample engine (default; safe for tests/offline).
        var analyticsCs = configuration.GetConnectionString("AnalyticsDb") ?? string.Empty;

        if (!string.IsNullOrWhiteSpace(analyticsCs))
        {
            // Register a singleton options instance with the connection string from config.
            var sqlOpts = new SqlAnalyticsOptions { ConnectionString = analyticsCs };
            services.AddSingleton(sqlOpts);
            services.AddSingleton<IOptions<SqlAnalyticsOptions>>(
                new Microsoft.Extensions.Options.OptionsWrapper<SqlAnalyticsOptions>(sqlOpts));

            services.AddScoped<ISemanticModelStore, KurdNezamSemanticModelStore>();
            services.AddScoped<IQueryEngine, SqlQueryEngine>();
        }
        else
        {
            // Default: in-memory pipeline (ported from analytics-web TypeScript engine)
            services.AddScoped<ISemanticModelStore, SemanticModelStore>();
            services.AddScoped<IQueryEngine, QueryEngine>();
        }

        // Real AI service. Registered WITHOUT AddHttpClient so it bypasses Aspire's standard
        // resilience handler (10s per-attempt timeout from AddServiceDefaults' ConfigureHttpClientDefaults),
        // which would abort the ~20s reasoning-model call. ArvanReportAiService uses a static
        // HttpClient with a 120s timeout instead.
        services.AddScoped<IReportAiService, ArvanReportAiService>();

        // Stub implementations — will be replaced in future iterations.
        services.AddScoped<IAiProviderRouter, AiProviderRouter>();
        services.AddScoped<IExportEngine, ExportEngine>();

        // Reads tenant context from the current user's claims.
        services.AddScoped<ITenantContext, TenantContext>();

        // Audit logger — writes AuditEvent rows; swallows exceptions so callers are never interrupted.
        services.AddScoped<IAuditLogger, AuditLogger>();

        return services;
    }
}
