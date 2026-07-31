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
using Mabhas19.Application.Common.Interfaces.Elections;
using Mabhas19.Application.Elections;
using Mabhas19.Infrastructure.Elections;
using Mabhas19.Infrastructure.Rooms;
using Mabhas19.Application.Common.Interfaces.Rooms;
using Mabhas19.Application.Rooms;

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
                // Keep existing browser and mobile sessions valid while clients move to ceo.api.
                options.TokenValidationParameters.ValidAudiences = ["mabhas19.api", "ceo.api"];
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

        // Election ballot crypto. Registered unconditionally — unlike the external integrations, this
        // has no third-party dependency, and both services report IsConfigured so a missing key makes
        // voting unavailable with a clear message instead of silently sealing ballots under a default.
        services.Configure<ElectionCryptoOptions>(config.GetSection(ElectionCryptoOptions.SectionName));
        services.AddSingleton<IVoterRoll, VoterRoll>();
        services.AddSingleton<IBallotSealer, BallotSealer>();

        // Room service (video meetings). The media server is a dedicated LiveKit instance on its own
        // machine; nothing here handles media, only tokens and admin calls. Registered unconditionally
        // and gated on IsConfigured, the same pattern as the ballot crypto: a missing key makes
        // meetings unavailable with a clear message rather than minting tokens nothing will accept.
        services.Configure<LiveKitOptions>(config.GetSection(LiveKitOptions.SectionName));

        // Where a join link points. Configuration rather than something derived from the incoming
        // request, so a link is identical whether it was made from the admin panel, a script, or a
        // request that reached us through the CDN with a rewritten host.
        services.Configure<RoomLinkOptions>(config.GetSection(RoomLinkOptions.SectionName));

        // Singleton, and the SAME instance serves both interfaces: RoomTokenService also mints the
        // server-wide admin token, which must stay reachable only from Infrastructure.
        services.AddSingleton<RoomTokenService>();
        services.AddSingleton<IRoomTokenService>(sp => sp.GetRequiredService<RoomTokenService>());
        services.AddSingleton<ILiveKitAdminToken>(sp => sp.GetRequiredService<RoomTokenService>());

        var liveKitUrl = config[$"{LiveKitOptions.SectionName}:ApiUrl"];
        services.AddHttpClient<ILiveKitAdmin, LiveKitAdmin>(c =>
            {
                if (!string.IsNullOrWhiteSpace(liveKitUrl))
                {
                    c.BaseAddress = new Uri(liveKitUrl.TrimEnd('/') + "/");
                }

                // A head-count must never hold a page open. The admin calls are fail-soft, so a
                // timeout degrades to zero rather than to an error.
                c.Timeout = TimeSpan.FromSeconds(8);
            })
            // The Authorization header carries a freshly minted admin token on every call. Default
            // request logging would not print it, but there is nothing here worth logging either.
            .RemoveAllLoggers();

        // The two ways into a meeting — a member opening it from their list, and a stranger opening a
        // link — share one implementation of the gates, for the same reason IBallotCaster below exists.
        // Scoped: it reads the request-scoped identity and DbContext.
        services.AddScoped<IRoomJoiner, RoomJoiner>();

        // The two voting channels share one implementation of the rules. Scoped because both take the
        // request-scoped DbContext. See Application/Elections/BallotCasting.cs for why the کد ملی is a
        // parameter on these and must never be one on a command.
        services.AddScoped<IBallotCaster, BallotCaster>();
        services.AddScoped<IElectionBrowser, ElectionBrowser>();

        // Bale bot (second voting channel). Registered unconditionally: IBaleClient.IsConfigured is
        // false without a token, and the webhook refuses up front — the same fail-loud-not-silent
        // pattern as the ballot crypto above.
        services.Configure<BaleOptions>(config.GetSection(BaleOptions.SectionName));
        services.Configure<VoteOtpOptions>(config.GetSection(VoteOtpOptions.SectionName));
        services.Configure<ElectionSmsOptions>(config.GetSection(ElectionSmsOptions.SectionName));

        // RemoveAllLoggers is NOT tidying. IHttpClientFactory's default logging writes the request URI
        // at Information level, and Bale puts the bot token IN THE PATH
        // (https://tapi.bale.ai/bot{token}/sendMessage) — so every message the bot sent would print the
        // token into the application log, which is usually less protected than the database. Anyone with
        // the log can then read every update and post as the bot.
        //
        // Verified: with the loggers left in place the line
        //   "Start processing HTTP request POST https://tapi.bale.ai/bot<TOKEN>/sendMessage"
        // appears on every send.
        services.AddHttpClient<IBaleClient, BaleClient>(c =>
                c.BaseAddress = new Uri("https://tapi.bale.ai/"))
            .RemoveAllLoggers();

        // These two carry their credentials in a header and a body, so the URI is harmless — but their
        // request logs are still a per-message timeline of OTP sends, and nothing needs it.
        services.AddHttpClient<IBaleSafirSender, BaleSafirSender>(c =>
                c.BaseAddress = new Uri("https://safir.bale.ai/"))
            .RemoveAllLoggers();
        services.AddHttpClient<IElectionSmsSender, ElectionSmsSender>()
            .RemoveAllLoggers();

        // The vote OTP store needs IMemoryCache and nothing else in this host registers it.
        services.AddMemoryCache();
        services.AddSingleton<IVoteOtpStore, VoteOtpStore>();
        // Singleton: the conversation state IS the store, so a scoped one would forget every message.
        services.AddSingleton<IBaleSessionStore, BaleSessionStore>();
        services.AddScoped<IVoteOtpSender, VoteOtpSender>();

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
