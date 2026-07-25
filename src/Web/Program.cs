using Mabhas19.Infrastructure.Data;
using Microsoft.AspNetCore.HttpOverrides;
using Scalar.AspNetCore;

var builder = WebApplication.CreateBuilder(args);

// Honour X-Forwarded-* headers from the reverse proxy (Traefik) so the app sees the
// original scheme/host and doesn't issue spurious HTTPS redirects.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// Add services to the container.
builder.AddServiceDefaults();

builder.AddKeyVaultIfConfigured();
builder.AddApplicationServices();
builder.AddInfrastructureServices();
builder.AddWebServices();

var app = builder.Build();

app.UseForwardedHeaders();

// Baseline security response headers (TLS terminates at the proxy, so HSTS is advertised here).
app.Use(async (context, next) =>
{
    var headers = context.Response.Headers;
    headers["X-Content-Type-Options"] = "nosniff";
    headers["X-Frame-Options"] = "DENY";
    headers["Referrer-Policy"] = "no-referrer";
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
    await next();
});

// Apply database migrations (and seed) on startup for every environment.
await app.InitialiseDatabaseAsync();

if (app.Environment.IsDevelopment())
{
    // TLS is terminated at the reverse proxy in container/production deployments,
    // so HTTPS redirection only runs locally.
    app.UseHttpsRedirection();
}

// CORS policy is configured from "Cors:AllowedOrigins" in AddWebServices.
app.UseCors();

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.UseFileServer();

app.MapOpenApi();
app.MapScalarApiReference();

app.UseExceptionHandler(options => { });

app.Map("/", () => Results.Redirect("/scalar"));

app.MapDefaultEndpoints();
app.MapEndpoints(typeof(Program).Assembly);


app.Run();
