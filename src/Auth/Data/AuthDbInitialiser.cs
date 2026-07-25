using Mabhas19.Auth.Data;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using OpenIddict.Abstractions;
using static OpenIddict.Abstractions.OpenIddictConstants;

namespace Mabhas19.Auth.Data;

public static class AuthDbInitialiserExtensions
{
    public static async Task InitialiseAuthAsync(this WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var initialiser = scope.ServiceProvider.GetRequiredService<AuthDbInitialiser>();
        await initialiser.InitialiseAsync();
        await initialiser.SeedAsync();
    }
}

public class AuthDbInitialiser(
    ILogger<AuthDbInitialiser> logger,
    AuthDbContext context,
    RoleManager<IdentityRole> roleManager,
    UserManager<AuthUser> userManager,
    IOpenIddictApplicationManager applicationManager,
    IOpenIddictScopeManager scopeManager,
    IConfiguration configuration)
{
    private const string AdministratorRole = "Administrator";
    private const string UserRole = "User";

    public async Task InitialiseAsync()
    {
        try
        {
            await context.Database.MigrateAsync();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "An error occurred while migrating the Auth database.");
            throw;
        }
    }

    public async Task SeedAsync()
    {
        try
        {
            await TrySeedAsync();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "An error occurred while seeding the Auth database.");
            throw;
        }
    }

    private async Task TrySeedAsync()
    {
        await SeedRolesAsync();
        await SeedScopesAsync();
        await SeedClientsAsync();
        await SeedAdminUserAsync();
    }

    // ── Roles ────────────────────────────────────────────────────────────────

    private async Task SeedRolesAsync()
    {
        foreach (var roleName in new[] { AdministratorRole, UserRole })
        {
            if (roleManager.Roles.All(r => r.Name != roleName))
            {
                await roleManager.CreateAsync(new IdentityRole(roleName));
                logger.LogInformation("Created role {Role}.", roleName);
            }
        }
    }

    // ── Scopes ───────────────────────────────────────────────────────────────

    private async Task SeedScopesAsync()
    {
        await EnsureScopeAsync("mabhas19.api", resources: ["mabhas19.api"]);
        await EnsureScopeAsync("plan.api",      resources: ["plan.api"]);
    }

    private async Task EnsureScopeAsync(string name, string[] resources)
    {
        if (await scopeManager.FindByNameAsync(name) is not null)
            return;

        await scopeManager.CreateAsync(new OpenIddictScopeDescriptor
        {
            Name      = name,
            Resources = { resources[0] }   // HashSet<string> initialiser
        });

        logger.LogInformation("Created OIDC scope {Scope}.", name);
    }

    // ── Clients ──────────────────────────────────────────────────────────────

    private async Task SeedClientsAsync()
    {
        // mabhas19-web — Confidential, Authorization Code + PKCE
        var webSecret   = configuration["Clients:Mabhas19Web:Secret"]   ?? string.Empty;
        var webRedirect = configuration["Clients:Mabhas19Web:Redirect"]  ?? string.Empty;
        var webPostLogout = configuration["Clients:Mabhas19Web:PostLogout"] ?? string.Empty;

        await EnsureClientAsync(new OpenIddictApplicationDescriptor
        {
            ClientId     = "mabhas19-web",
            ClientSecret = webSecret,
            ClientType   = ClientTypes.Confidential,
            DisplayName  = "Mabhas19 Web",
            RedirectUris      = { new Uri(webRedirect) },
            PostLogoutRedirectUris = { new Uri(webPostLogout) },
            Permissions =
            {
                Permissions.Endpoints.Authorization,
                Permissions.Endpoints.Token,
                Permissions.Endpoints.EndSession,
                Permissions.GrantTypes.AuthorizationCode,
                Permissions.GrantTypes.RefreshToken,
                Permissions.ResponseTypes.Code,
                Permissions.Scopes.Email,
                Permissions.Scopes.Profile,
                Permissions.Scopes.Roles,
                Permissions.Prefixes.Scope + "mabhas19.api"
            },
            Requirements = { Requirements.Features.ProofKeyForCodeExchange }
        });

        // mabhas19-mobile — Public, Authorization Code + PKCE (custom scheme redirect)
        var mobileRedirect = configuration["Clients:Mabhas19Mobile:Redirect"] ?? string.Empty;

        await EnsureClientAsync(new OpenIddictApplicationDescriptor
        {
            ClientId    = "mabhas19-mobile",
            ClientType  = ClientTypes.Public,
            DisplayName = "Mabhas19 Mobile",
            RedirectUris = { new Uri(mobileRedirect) },
            Permissions =
            {
                Permissions.Endpoints.Authorization,
                Permissions.Endpoints.Token,
                Permissions.Endpoints.EndSession,
                Permissions.GrantTypes.AuthorizationCode,
                Permissions.GrantTypes.RefreshToken,
                Permissions.ResponseTypes.Code,
                Permissions.Scopes.Email,
                Permissions.Scopes.Profile,
                Permissions.Scopes.Roles,
                Permissions.Prefixes.Scope + "mabhas19.api"
            },
            Requirements = { Requirements.Features.ProofKeyForCodeExchange }
        });

        // plan-web — Confidential, Authorization Code + PKCE (future plan service)
        var planSecret    = configuration["Clients:PlanWeb:Secret"]   ?? string.Empty;
        var planRedirect  = configuration["Clients:PlanWeb:Redirect"]  ?? string.Empty;

        await EnsureClientAsync(new OpenIddictApplicationDescriptor
        {
            ClientId     = "plan-web",
            ClientSecret = planSecret,
            ClientType   = ClientTypes.Confidential,
            DisplayName  = "Plan Web",
            RedirectUris = { new Uri(planRedirect) },
            Permissions =
            {
                Permissions.Endpoints.Authorization,
                Permissions.Endpoints.Token,
                Permissions.Endpoints.EndSession,
                Permissions.GrantTypes.AuthorizationCode,
                Permissions.GrantTypes.RefreshToken,
                Permissions.ResponseTypes.Code,
                Permissions.Scopes.Email,
                Permissions.Scopes.Profile,
                Permissions.Scopes.Roles,
                Permissions.Prefixes.Scope + "plan.api"
            },
            Requirements = { Requirements.Features.ProofKeyForCodeExchange }
        });

        // analytics-web — Public, Authorization Code + PKCE (https web redirects), for analytic.myceo.ir.
        // Optional: only seeded when its redirect URI is configured, and empty URIs are skipped so a
        // missing ANALYTICS_DOMAIN can never abort the whole client seed with a UriFormatException.
        var analyticsRedirect   = configuration["Clients:AnalyticsWeb:Redirect"]   ?? string.Empty;
        var analyticsSilent     = configuration["Clients:AnalyticsWeb:Silent"]     ?? string.Empty;
        var analyticsPostLogout = configuration["Clients:AnalyticsWeb:PostLogout"] ?? string.Empty;

        if (!string.IsNullOrWhiteSpace(analyticsRedirect))
        {
            var analyticsClient = new OpenIddictApplicationDescriptor
            {
                ClientId    = "analytics-web",
                ClientType  = ClientTypes.Public,
                DisplayName = "Analytics Web",
                Permissions =
                {
                    Permissions.Endpoints.Authorization,
                    Permissions.Endpoints.Token,
                    Permissions.Endpoints.EndSession,
                    Permissions.GrantTypes.AuthorizationCode,
                    Permissions.GrantTypes.RefreshToken,
                    Permissions.ResponseTypes.Code,
                    Permissions.Scopes.Email,
                    Permissions.Scopes.Profile,
                    Permissions.Scopes.Roles,
                    Permissions.Prefixes.Scope + "mabhas19.api"
                },
                Requirements = { Requirements.Features.ProofKeyForCodeExchange }
            };
            analyticsClient.RedirectUris.Add(new Uri(analyticsRedirect));
            if (!string.IsNullOrWhiteSpace(analyticsSilent))
                analyticsClient.RedirectUris.Add(new Uri(analyticsSilent));
            if (!string.IsNullOrWhiteSpace(analyticsPostLogout))
                analyticsClient.PostLogoutRedirectUris.Add(new Uri(analyticsPostLogout));

            await EnsureClientAsync(analyticsClient);
        }

        // mun-sanandaj-web — Public, Authorization Code + PKCE, for mun-sanandaj.myceo.ir.
        // Optional: only seeded when its redirect URI is configured (same pattern as analytics-web).
        var munSanandajRedirect   = configuration["Clients:MunSanandajWeb:Redirect"]   ?? string.Empty;
        var munSanandajSilent     = configuration["Clients:MunSanandajWeb:Silent"]     ?? string.Empty;
        var munSanandajPostLogout = configuration["Clients:MunSanandajWeb:PostLogout"] ?? string.Empty;

        if (!string.IsNullOrWhiteSpace(munSanandajRedirect))
        {
            var munSanandajClient = new OpenIddictApplicationDescriptor
            {
                ClientId    = "mun-sanandaj-web",
                ClientType  = ClientTypes.Public,
                DisplayName = "Mun Sanandaj Web",
                Permissions =
                {
                    Permissions.Endpoints.Authorization,
                    Permissions.Endpoints.Token,
                    Permissions.Endpoints.EndSession,
                    Permissions.GrantTypes.AuthorizationCode,
                    Permissions.GrantTypes.RefreshToken,
                    Permissions.ResponseTypes.Code,
                    Permissions.Scopes.Email,
                    Permissions.Scopes.Profile,
                    Permissions.Scopes.Roles,
                    Permissions.Prefixes.Scope + "mabhas19.api"
                },
                Requirements = { Requirements.Features.ProofKeyForCodeExchange }
            };
            munSanandajClient.RedirectUris.Add(new Uri(munSanandajRedirect));
            if (!string.IsNullOrWhiteSpace(munSanandajSilent))
                munSanandajClient.RedirectUris.Add(new Uri(munSanandajSilent));
            if (!string.IsNullOrWhiteSpace(munSanandajPostLogout))
                munSanandajClient.PostLogoutRedirectUris.Add(new Uri(munSanandajPostLogout));

            await EnsureClientAsync(munSanandajClient);
        }

        // landing-panel — Public, Authorization Code + PKCE, for landing-panel.myceo.ir.
        // The admin panel for the kurdnezam landing site. Only administrators can use it, but the
        // role check lives on the API (/api/kurdnezam writes) — the IdP just issues the token.
        // Optional: only seeded when its redirect URI is configured (same pattern as analytics-web).
        var landingPanelRedirect   = configuration["Clients:LandingPanel:Redirect"]   ?? string.Empty;
        var landingPanelSilent     = configuration["Clients:LandingPanel:Silent"]     ?? string.Empty;
        var landingPanelPostLogout = configuration["Clients:LandingPanel:PostLogout"] ?? string.Empty;

        if (!string.IsNullOrWhiteSpace(landingPanelRedirect))
        {
            var landingPanelClient = new OpenIddictApplicationDescriptor
            {
                ClientId    = "landing-panel",
                ClientType  = ClientTypes.Public,
                DisplayName = "Landing Panel",
                Permissions =
                {
                    Permissions.Endpoints.Authorization,
                    Permissions.Endpoints.Token,
                    Permissions.Endpoints.EndSession,
                    Permissions.GrantTypes.AuthorizationCode,
                    Permissions.GrantTypes.RefreshToken,
                    Permissions.ResponseTypes.Code,
                    Permissions.Scopes.Email,
                    Permissions.Scopes.Profile,
                    Permissions.Scopes.Roles,
                    Permissions.Prefixes.Scope + "mabhas19.api"
                },
                Requirements = { Requirements.Features.ProofKeyForCodeExchange }
            };
            landingPanelClient.RedirectUris.Add(new Uri(landingPanelRedirect));
            if (!string.IsNullOrWhiteSpace(landingPanelSilent))
                landingPanelClient.RedirectUris.Add(new Uri(landingPanelSilent));
            if (!string.IsNullOrWhiteSpace(landingPanelPostLogout))
                landingPanelClient.PostLogoutRedirectUris.Add(new Uri(landingPanelPostLogout));

            await EnsureClientAsync(landingPanelClient);
        }

        // admin-web — Public, Authorization Code + PKCE, for admin.myceo.ir (the central user-
        // management SPA). It is NOT a grantable service: access is gated by the Administrator role
        // at api/admin, not by a service grant, so ServiceKeys maps it to no key. It requests the
        // mabhas19.api scope so the token the IdP validates locally for its own admin API carries
        // the roles claim. Optional: only seeded when its redirect URI is configured (same pattern
        // as analytics-web).
        var adminWebRedirect   = configuration["Clients:AdminWeb:Redirect"]   ?? string.Empty;
        var adminWebSilent     = configuration["Clients:AdminWeb:Silent"]     ?? string.Empty;
        var adminWebPostLogout = configuration["Clients:AdminWeb:PostLogout"] ?? string.Empty;

        if (!string.IsNullOrWhiteSpace(adminWebRedirect))
        {
            var adminWebClient = new OpenIddictApplicationDescriptor
            {
                ClientId    = "admin-web",
                ClientType  = ClientTypes.Public,
                DisplayName = "Admin Web",
                Permissions =
                {
                    Permissions.Endpoints.Authorization,
                    Permissions.Endpoints.Token,
                    Permissions.Endpoints.EndSession,
                    Permissions.GrantTypes.AuthorizationCode,
                    Permissions.GrantTypes.RefreshToken,
                    Permissions.ResponseTypes.Code,
                    Permissions.Scopes.Email,
                    Permissions.Scopes.Profile,
                    Permissions.Scopes.Roles,
                    Permissions.Prefixes.Scope + "mabhas19.api"
                },
                Requirements = { Requirements.Features.ProofKeyForCodeExchange }
            };
            adminWebClient.RedirectUris.Add(new Uri(adminWebRedirect));
            if (!string.IsNullOrWhiteSpace(adminWebSilent))
                adminWebClient.RedirectUris.Add(new Uri(adminWebSilent));
            if (!string.IsNullOrWhiteSpace(adminWebPostLogout))
                adminWebClient.PostLogoutRedirectUris.Add(new Uri(adminWebPostLogout));

            await EnsureClientAsync(adminWebClient);
        }

        // walfare-web — Public, Authorization Code + PKCE, for refahi.kurdnezam.ir (the engineers'
        // welfare dashboard, سامانه رفاهی مهندسین). Its unauthenticated authorize is routed to the
        // کد ملی + OTP page (see AuthorizationController), and provisioning grants ONLY the
        // "walfare" service. Optional: only seeded when its redirect URI is configured.
        var walfareRedirect   = configuration["Clients:WalfareWeb:Redirect"]   ?? string.Empty;
        var walfareSilent     = configuration["Clients:WalfareWeb:Silent"]     ?? string.Empty;
        var walfarePostLogout = configuration["Clients:WalfareWeb:PostLogout"] ?? string.Empty;

        if (!string.IsNullOrWhiteSpace(walfareRedirect))
        {
            var walfareClient = new OpenIddictApplicationDescriptor
            {
                ClientId    = "walfare-web",
                ClientType  = ClientTypes.Public,
                DisplayName = "Engineers' Welfare",
                Permissions =
                {
                    Permissions.Endpoints.Authorization,
                    Permissions.Endpoints.Token,
                    Permissions.Endpoints.EndSession,
                    Permissions.GrantTypes.AuthorizationCode,
                    Permissions.GrantTypes.RefreshToken,
                    Permissions.ResponseTypes.Code,
                    Permissions.Scopes.Email,
                    Permissions.Scopes.Profile,
                    Permissions.Scopes.Roles,
                    Permissions.Prefixes.Scope + "mabhas19.api"
                },
                Requirements = { Requirements.Features.ProofKeyForCodeExchange }
            };
            walfareClient.RedirectUris.Add(new Uri(walfareRedirect));
            if (!string.IsNullOrWhiteSpace(walfareSilent))
                walfareClient.RedirectUris.Add(new Uri(walfareSilent));
            if (!string.IsNullOrWhiteSpace(walfarePostLogout))
                walfareClient.PostLogoutRedirectUris.Add(new Uri(walfarePostLogout));

            await EnsureClientAsync(walfareClient);
        }
    }

    private async Task EnsureClientAsync(OpenIddictApplicationDescriptor descriptor)
    {
        if (await applicationManager.FindByClientIdAsync(descriptor.ClientId!) is not null)
            return;

        await applicationManager.CreateAsync(descriptor);
        logger.LogInformation("Created OIDC client {ClientId}.", descriptor.ClientId);
    }

    // ── Admin user ───────────────────────────────────────────────────────────

    private async Task SeedAdminUserAsync()
    {
        var adminEmail    = configuration["AdminUser:Email"];
        var adminPassword = configuration["AdminUser:Password"];

        if (string.IsNullOrWhiteSpace(adminEmail) || string.IsNullOrWhiteSpace(adminPassword))
        {
            logger.LogWarning("AdminUser:Email/Password not configured; skipping administrator seeding.");
            return;
        }

        var administrator = await userManager.FindByEmailAsync(adminEmail);
        if (administrator is null)
        {
            administrator = new AuthUser
            {
                UserName       = adminEmail,
                Email          = adminEmail,
                EmailConfirmed = true
            };

            var created = await userManager.CreateAsync(administrator, adminPassword);
            if (!created.Succeeded)
            {
                logger.LogWarning("Could not create admin user: {Errors}",
                    string.Join("; ", created.Errors.Select(e => e.Description)));
                return;
            }

            logger.LogInformation("Created administrator account {Email}.", adminEmail);
        }

        if (!await userManager.IsInRoleAsync(administrator, AdministratorRole))
        {
            await userManager.AddToRoleAsync(administrator, AdministratorRole);
        }
    }
}
