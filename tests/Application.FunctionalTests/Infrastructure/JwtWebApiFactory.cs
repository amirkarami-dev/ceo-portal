using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace Mabhas19.Application.FunctionalTests.Infrastructure;

/// <summary>
/// A <see cref="WebApplicationFactory{TProgram}"/> variant used exclusively for
/// JWT resource-server contract tests.  Unlike <see cref="WebApiFactory"/> it does
/// NOT replace <c>IUser</c> with a Moq mock — the real <see cref="Mabhas19.Web.Services.CurrentUser"/>
/// reads claims directly from the validated JWT, which is what the tests exercise.
///
/// To avoid a live IdP the factory replaces the JWT bearer options (including all
/// framework-registered post-configure handlers) with a fresh <see cref="JwtBearerOptions"/>
/// that trusts a caller-supplied RSA key directly.
/// </summary>
public sealed class JwtWebApiFactory : WebApplicationFactory<Program>
{
    private readonly string _connectionString;
    private readonly RsaSecurityKey _signingKey;

    /// <summary>
    /// The issuer string baked into test tokens and trusted by this factory.
    /// Must match the <c>iss</c> claim in every token produced by
    /// <see cref="JwtTokenHelper"/>.
    /// </summary>
    public const string TestIssuer = "https://test-idp";

    /// <summary>The expected audience accepted by the API under test.</summary>
    public const string TestAudience = "mabhas19.api";

    public JwtWebApiFactory(string connectionString, RsaSecurityKey signingKey)
    {
        _connectionString = connectionString;
        _signingKey = signingKey;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        // Point the app at the Aspire-provisioned SQL Server so EF migrations run fine.
        builder.UseSetting("ConnectionStrings:Mabhas19Db", _connectionString);

        builder.ConfigureTestServices(services =>
        {
            // Remove ALL existing configure/post-configure/validate handlers for
            // JwtBearerOptions so no OIDC discovery or Authority-based configuration
            // can interfere with our test key.
            services.RemoveAll<IConfigureOptions<JwtBearerOptions>>();
            services.RemoveAll<IPostConfigureOptions<JwtBearerOptions>>();
            services.RemoveAll<IValidateOptions<JwtBearerOptions>>();

            // Register a fresh, fully-explicit configuration that trusts only our
            // test RSA key.  IUser is intentionally NOT replaced here — the real
            // CurrentUser must derive identity from the JWT claims.
            services.AddOptions<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme)
                .Configure(o =>
                {
                    o.RequireHttpsMetadata = false;
                    // Disable inbound claim mapping so "role" stays as "role" (not remapped
                    // to the WS-Federation URI) — required for RoleClaimType="role" to work.
                    o.MapInboundClaims = false;
                    o.TokenValidationParameters = new TokenValidationParameters
                    {
                        ValidateIssuer = true,
                        ValidIssuer = TestIssuer,
                        ValidateAudience = true,
                        ValidAudience = TestAudience,
                        ValidateIssuerSigningKey = true,
                        IssuerSigningKey = _signingKey,
                        ValidateLifetime = true,
                        NameClaimType = "name",
                        RoleClaimType = "role"
                    };
                });

            // Register a final post-configure that runs after all others to ensure
            // our TokenValidationParameters are not overwritten by any residual
            // framework post-configure pipeline.
            services.AddSingleton<IPostConfigureOptions<JwtBearerOptions>>(
                new TestJwtBearerPostConfigure(_signingKey));
        });
    }

    /// <summary>
    /// Last-in-chain post-configure that stamps the final <see cref="TokenValidationParameters"/>
    /// onto the options, preventing any framework or OIDC layer from overriding them.
    /// </summary>
    private sealed class TestJwtBearerPostConfigure(RsaSecurityKey key)
        : IPostConfigureOptions<JwtBearerOptions>
    {
        public void PostConfigure(string? name, JwtBearerOptions options)
        {
            if (name != JwtBearerDefaults.AuthenticationScheme) return;

            // Disable any OIDC metadata retrieval.
            options.Authority = null;
            options.MetadataAddress = null!;
            options.RequireHttpsMetadata = false;
            options.ConfigurationManager = null;

            // MapInboundClaims defaults to true in JwtBearerOptions, which causes
            // JsonWebTokenHandler to remap "role" → ClaimTypes.Role (the WS-Fed URI).
            // Disabling it keeps claim types as they appear in the JWT payload, so
            // RoleClaimType="role" and CurrentUser.FindAll("role") both work correctly.
            options.MapInboundClaims = false;

            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidIssuer = TestIssuer,
                ValidateAudience = true,
                ValidAudience = TestAudience,
                ValidateIssuerSigningKey = true,
                IssuerSigningKey = key,
                ValidateLifetime = true,
                NameClaimType = "name",
                RoleClaimType = "role"
            };
        }
    }
}
