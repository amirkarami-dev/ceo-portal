using System.Threading.RateLimiting;
using Mabhas19.Auth.Data;
using Mabhas19.Auth.External;
using Mabhas19.Auth.Otp;
using Mabhas19.Auth.Sms;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);
builder.AddServiceDefaults();

// Honour X-Forwarded-* from the reverse proxy (Traefik) so OpenIddict sees the original
// HTTPS scheme/host and serves correct issuer metadata (TLS terminates at the proxy in prod).
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();
});

// The Data Protection key ring MUST outlive the container: it encrypts the login form's
// antiforgery token and the auth cookie. Without this the keys are kept in-memory only, so every
// redeploy made the next login POST fail with "The key {...} was not found in the key ring" and
// signed every user out. /keys is a bind mount owned by the app UID (1654).
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo("/keys"))
    .SetApplicationName("mabhas19-auth");

builder.Services.AddDbContext<AuthDbContext>(o =>
{
    o.UseSqlServer(builder.Configuration.GetConnectionString("Mabhas19AuthDb"));
    o.UseOpenIddict(); // registers OpenIddict's EF Core stores' entity sets
    // The AddUserServiceAccess migration is hand-authored (the dotnet-ef design-time build could not
    // resolve the shared ServiceDefaults source-generator on the build box), so AuthDbContextModelSnapshot
    // is not yet regenerated and EF Core 10's startup pending-changes check would otherwise abort
    // MigrateAsync. The migration itself is correct and creates the right table. FOLLOW-UP: regenerate the
    // snapshot with `dotnet ef migrations add` once the analyzer restore is fixed, then remove this line.
    o.ConfigureWarnings(w => w.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
});
builder.Services.AddIdentity<AuthUser, IdentityRole>()
    .AddEntityFrameworkStores<AuthDbContext>()
    .AddDefaultTokenProviders();

// Identity cookie paths — defaults already match, but made explicit for clarity.
builder.Services.ConfigureApplicationCookie(o =>
{
    o.LoginPath = "/Account/Login";
    o.LogoutPath = "/Account/Logout";
});

// OTP / SMS / Google services
builder.Services.AddDistributedMemoryCache();
builder.Services.Configure<OtpOptions>(builder.Configuration.GetSection(OtpOptions.SectionName));
builder.Services.Configure<SmsOptions>(builder.Configuration.GetSection(SmsOptions.SectionName));
builder.Services.Configure<GoogleAuthOptions>(builder.Configuration.GetSection(GoogleAuthOptions.SectionName));
builder.Services.AddScoped<IOtpService, OtpService>();
// Pick the SMS implementation by configured provider: Mihan receives the complete OTP message,
// while msgway requires a template parameter. The generic sender handles relay/kavenegar/log.
var smsProvider = builder.Configuration[$"{SmsOptions.SectionName}:Provider"] ?? "mihan";
if (string.Equals(smsProvider, "mihan", StringComparison.OrdinalIgnoreCase))
    builder.Services.AddHttpClient<ISmsSender, MihanSmsSender>();
else if (string.Equals(smsProvider, "direct", StringComparison.OrdinalIgnoreCase))
    builder.Services.AddHttpClient<ISmsSender, SmsDirectSender>();
else
    builder.Services.AddHttpClient<ISmsSender, SmsSender>();
builder.Services.AddScoped<IGoogleTokenValidator, GoogleTokenValidator>();
builder.Services.AddScoped<IFarsNezamDirectory, FarsNezamDirectory>();
builder.Services.AddScoped<IKurdNezamDirectory, KurdNezamDirectory>();

// Per-user product-service grants (read at authorize to emit the 'svc' claim + enforce access).
builder.Services.AddScoped<IServiceAccessStore, ServiceAccessStore>();

// The FarsNezam magic-link is unsigned (accepted risk), so the auto-provisioning page gets
// a per-IP rate limit to blunt enumeration of membership codes.
builder.Services.AddRateLimiter(o =>
{
    o.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    o.AddPolicy("fars-login", ctx => RateLimitPartition.GetFixedWindowLimiter(
        ctx.Connection.RemoteIpAddress?.ToString() ?? "anon",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));
});

builder.Services.AddScoped<AuthDbInitialiser>();

builder.Services.AddControllersWithViews();
builder.Services.AddRazorPages();

// CORS for browser SPA clients (e.g. analytics-web) that call the IdP's discovery / JWKS / token /
// userinfo endpoints cross-origin via oidc-client-ts. mabhas19-web does OIDC server-side (Auth.js)
// and needs none. Origins come from Cors:AllowedOrigins (env Cors__AllowedOrigins__N); empty = no CORS.
var spaCorsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? Array.Empty<string>();
builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
    {
        if (spaCorsOrigins.Length > 0)
            policy.WithOrigins(spaCorsOrigins).AllowAnyHeader().AllowAnyMethod();
    }));

builder.Services.AddOpenIddict()
    .AddCore(o => o.UseEntityFrameworkCore().UseDbContext<AuthDbContext>())
    .AddServer(o =>
    {
        o.SetAuthorizationEndpointUris("connect/authorize")
         .SetTokenEndpointUris("connect/token")
         .SetUserInfoEndpointUris("connect/userinfo")
         .SetEndSessionEndpointUris("connect/logout");

        o.AllowAuthorizationCodeFlow().RequireProofKeyForCodeExchange()
         .AllowRefreshTokenFlow();

        o.RegisterScopes("openid", "profile", "email", "roles", "offline_access", "mabhas19.api", "plan.api");

        o.SetAccessTokenLifetime(TimeSpan.FromMinutes(30));
        o.SetRefreshTokenLifetime(TimeSpan.FromDays(14));

        // CRITICAL: signed (NOT encrypted) JWT access tokens, so resource servers can
        // validate via JWKS with standard AddJwtBearer — no OpenIddict client required.
        o.DisableAccessTokenEncryption();

        if (builder.Environment.IsDevelopment())
        {
            o.AddDevelopmentEncryptionCertificate().AddDevelopmentSigningCertificate();
        }
        else
        {
            // Use the Stream overload to avoid the obsolete X509Certificate2(string, string)
            // constructor that is an error under TreatWarningsAsErrors in .NET 10.
            var certPath = builder.Configuration["OpenIddict:SigningCertificatePath"]!;
            var certPwd = builder.Configuration["OpenIddict:SigningCertificatePassword"];
            o.AddSigningCertificate(File.OpenRead(certPath), certPwd);
            o.AddEncryptionCertificate(File.OpenRead(certPath), certPwd);
        }

        var aspnet = o.UseAspNetCore()
            .EnableAuthorizationEndpointPassthrough()
            .EnableTokenEndpointPassthrough()
            .EnableUserInfoEndpointPassthrough()
            .EnableEndSessionEndpointPassthrough();

        // In dev there is no TLS (prod terminates TLS at Traefik and forwards X-Forwarded-Proto),
        // so allow plain HTTP to the OpenIddict endpoints only when developing.
        if (builder.Environment.IsDevelopment())
        {
            aspnet.DisableTransportSecurityRequirement();
        }
    })
    .AddValidation(o => { o.UseLocalServer(); o.UseAspNetCore(); });

var app = builder.Build();

app.UseForwardedHeaders();

await app.InitialiseAuthAsync();

app.UseRouting();
app.UseCors();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapDefaultEndpoints();
app.MapControllers();
app.MapRazorPages();
app.MapGet("/", () => "Mabhas19 Auth");

app.Run();
public partial class Program;

namespace Mabhas19.Auth
{
    /// <summary>
    /// Marker type used by <c>WebApplicationFactory&lt;AuthApiMarker&gt;</c> to target this
    /// assembly unambiguously when both <c>Mabhas19.Auth</c> and <c>Mabhas19.Web</c> define
    /// a top-level <c>public partial class Program</c>.
    /// </summary>
    public sealed class AuthApiMarker;
}
