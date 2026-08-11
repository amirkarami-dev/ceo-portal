using System.Threading.RateLimiting;
using Azure.Identity;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Infrastructure.Data;
using Mabhas19.Web;
using Mabhas19.Web.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace Microsoft.Extensions.DependencyInjection;

public static class DependencyInjection
{
    public static void AddWebServices(this IHostApplicationBuilder builder)
    {
        builder.Services.AddDatabaseDeveloperPageExceptionFilter();

        builder.Services.AddScoped<IUser, CurrentUser>();

        builder.Services.AddHttpContextAccessor();

        builder.Services.AddExceptionHandler<ProblemDetailsExceptionHandler>();

        // Customise default API behaviour
        builder.Services.Configure<ApiBehaviorOptions>(options =>
            options.SuppressModelStateInvalidFilter = true);

        builder.Services.AddEndpointsApiExplorer();

        builder.Services.AddOpenApi(options =>
        {
            options.AddOperationTransformer<ApiExceptionOperationTransformer>();
            options.AddDocumentTransformer<BearerSecuritySchemeTransformer>();
        });

        // CORS: only the configured origins may call the API (browser clients send bearer
        // tokens in the Authorization header). An empty/missing list = no cross-origin access.
        var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? [];
        builder.Services.AddCors(options =>
            options.AddDefaultPolicy(policy =>
            {
                if (allowedOrigins.Length > 0)
                {
                    policy.WithOrigins(allowedOrigins).AllowAnyHeader().AllowAnyMethod();

                    // Needed by ONE route, and without it that route cannot work at all:
                    // /api/VmsMedia/session answers with a Set-Cookie the browser must keep, and a
                    // browser discards a cookie from a cross-origin response unless the response
                    // also says Access-Control-Allow-Credentials. The camera panel is a different
                    // origin from this API by design — video never touches the main box — so the
                    // media session is always cross-origin.
                    //
                    // Safe here because the origin list is explicit: WithOrigins echoes only the
                    // hosts above, and AllowCredentials is illegal alongside AllowAnyOrigin, so
                    // this cannot silently widen if the list is ever replaced by a wildcard.
                    policy.AllowCredentials();
                }
            }));

        // Per-client request throttling. Behind Traefik the original client IP arrives via
        // X-Forwarded-For (honoured by UseForwardedHeaders), so partition on that when present.
        builder.Services.AddRateLimiter(options =>
        {
            options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
            options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(context =>
            {
                var clientIp = context.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0].Trim();
                if (string.IsNullOrEmpty(clientIp))
                {
                    clientIp = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                }

                return RateLimitPartition.GetFixedWindowLimiter(clientIp, _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 120,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0
                });
            });

            // Routes the public can write to without an account. 120/minute is far too generous for
            // something that accepts files and creates rows; a real person filling in a form needs
            // a handful an hour. Partitioned on the same forwarded client IP as the global limiter.
            options.AddPolicy(RateLimitPolicies.PublicSubmission, context =>
            {
                var clientIp = context.Request.Headers["X-Forwarded-For"].FirstOrDefault()?.Split(',')[0].Trim();
                if (string.IsNullOrEmpty(clientIp))
                {
                    clientIp = context.Connection.RemoteIpAddress?.ToString() ?? "unknown";
                }

                return RateLimitPartition.GetFixedWindowLimiter(clientIp, _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = 10,
                    Window = TimeSpan.FromMinutes(10),
                    QueueLimit = 0
                });
            });
        });
    }

    public static void AddKeyVaultIfConfigured(this IHostApplicationBuilder builder)
    {
        var keyVaultUri = builder.Configuration["AZURE_KEY_VAULT_ENDPOINT"];
        if (!string.IsNullOrWhiteSpace(keyVaultUri))
        {
            builder.Configuration.AddAzureKeyVault(
                new Uri(keyVaultUri),
                new DefaultAzureCredential());
        }
    }
}
