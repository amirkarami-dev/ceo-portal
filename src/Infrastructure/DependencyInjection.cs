using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Interfaces.MunSanandaj;
using Mabhas19.Infrastructure.Analytics;
using Mabhas19.Infrastructure.Data;
using Mabhas19.Infrastructure.Data.Interceptors;
using Mabhas19.Infrastructure.External;
using Mabhas19.Infrastructure.MunSanandaj;
using Mabhas19.Infrastructure.MunSanandaj.Sql;
using Mabhas19.Infrastructure.Payments;
using Mabhas19.Infrastructure.Reporting;
using Mabhas19.Infrastructure.Storage;
using Mabhas19.Infrastructure.Subscriptions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Minio;

namespace Microsoft.Extensions.DependencyInjection;

public static class DependencyInjection
{
    public static void AddInfrastructureServices(this IHostApplicationBuilder builder)
    {
        var connectionString = builder.Configuration.GetConnectionString(Services.Database);
        Guard.Against.Null(connectionString, message: $"Connection string '{Services.Database}' not found.");

        builder.Services.AddScoped<ISaveChangesInterceptor, AuditableEntityInterceptor>();
        builder.Services.AddScoped<ISaveChangesInterceptor, DispatchDomainEventsInterceptor>();

        builder.Services.AddDbContext<ApplicationDbContext>((sp, options) =>
        {
            options.AddInterceptors(sp.GetServices<ISaveChangesInterceptor>());
            options.UseSqlServer(connectionString);
            options.ConfigureWarnings(warnings => warnings.Ignore(RelationalEventId.PendingModelChangesWarning));
        });

        builder.EnrichSqlServerDbContext<ApplicationDbContext>();

        builder.Services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<ApplicationDbContext>());

        builder.Services.AddScoped<ApplicationDbContextInitialiser>();

        builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.Authority = builder.Configuration["Auth:Authority"];
                options.Audience = "mabhas19.api";
                options.RequireHttpsMetadata = !builder.Environment.IsDevelopment();
                // Disable inbound claim-type remapping so JWT claim names (e.g. "role",
                // "sub", "name") are preserved as-is in the ClaimsIdentity.  Without this
                // the default MapInboundClaims=true would remap "role" to the WS-Federation
                // URI, breaking RoleClaimType="role" and CurrentUser.Roles lookups.
                options.MapInboundClaims = false;
                options.TokenValidationParameters.NameClaimType = "name";
                options.TokenValidationParameters.RoleClaimType = "role";
            });

        builder.Services.AddAuthorizationBuilder();

        builder.Services.AddSingleton(TimeProvider.System);

        AddMabhas19Services(builder);
    }

    private static void AddMabhas19Services(IHostApplicationBuilder builder)
    {
        var services = builder.Services;
        var config = builder.Configuration;

        // Options
        services.Configure<MinioOptions>(config.GetSection(MinioOptions.SectionName));
        services.Configure<NezamMohandesiOptions>(config.GetSection(NezamMohandesiOptions.SectionName));
        services.Configure<FarsNezamOptions>(config.GetSection(FarsNezamOptions.SectionName));

        // Object storage (MinIO / S3).
        services.AddSingleton<IMinioClient>(sp =>
        {
            var o = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<MinioOptions>>().Value;
            return new MinioClient()
                .WithEndpoint(o.Endpoint)
                .WithCredentials(o.AccessKey, o.SecretKey)
                .WithSSL(o.UseSSL)
                .Build();
        });
        services.AddScoped<IFileStorage, MinioFileStorage>();

        // PDF reporting (QuestPDF community license + Persian font registration).
        QuestPDF.Settings.License = QuestPDF.Infrastructure.LicenseType.Community;
        ReportFonts.Register(builder.Environment.ContentRootPath);
        services.AddScoped<IReportGenerator, QuestPdfReportGenerator>();

        // Subscriptions.
        services.AddScoped<ISubscriptionService, SubscriptionService>();

        // Welfare (سامانه رفاهی مهندسین): Iran Kish gateway + the org membership directory that
        // snapshots who is reserving. The directory shares the mun-sanandaj KurdNezamDb secret.
        // NOTE: this file's namespace is Microsoft.Extensions.DependencyInjection (template
        // convention), so relative qualifiers like Payments.X do not resolve — plain names + usings.
        services.Configure<IranKishOptions>(config.GetSection(IranKishOptions.SectionName));
        services.AddHttpClient(nameof(IranKishGateway));
        services.AddScoped<IPaymentGateway, IranKishGateway>();
        services.AddScoped<IEngineerDirectory, KurdNezamEngineerDirectory>();

        // External project import providers (collected as IEnumerable<IExternalProjectProvider>).
        services.AddHttpClient<IExternalProjectProvider, NezamMohandesiProjectProvider>();
        services.AddScoped<IExternalProjectProvider, FarsNezamProjectProvider>();

        // Analytics module (query engine + AI report-generation service).
        services.AddAnalyticsServices(config);

        // MunSanandaj integration (KurdNezam SQL -> mahyapardaz REST). Gated off entirely when
        // ConnectionStrings:KurdNezamDb is empty, mirroring the AnalyticsDb/FarsNezamDb pattern —
        // so local dev/CI never fails for lacking this external, credentialed municipal DB.
        var kurdNezamCs = config.GetConnectionString("KurdNezamDb") ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(kurdNezamCs))
        {
            services.Configure<MunSanandajOptions>(config.GetSection(MunSanandajOptions.SectionName));
            services.AddSingleton<IMunSanandajSourceReader, MunSanandajSourceReader>();
            services.AddSingleton<IMunSanandajGatewayClient, MunSanandajGatewayClient>();
            services.AddSingleton<IMunSanandajPdfFetcher, MunSanandajPdfFetcher>();
            services.AddScoped<IMunSanandajSyncService, MunSanandajSyncService>();
            services.AddHostedService<SaveEngineerReportWorker>();

            // SaveEngMapWorker is intentionally NOT started for now — the engineer-map flow will be
            // redesigned (its interaction with the shared sp1 list + the new WebS_AddSabtNoToReport
            // write-back needs a different approach). Re-enable this line once that design is decided.
            // services.AddHostedService<SaveEngMapWorker>();
        }
    }
}
