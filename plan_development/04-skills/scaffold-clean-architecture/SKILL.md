---
name: scaffold-clean-architecture
description: Use when bootstrapping a new .NET 10 Clean Architecture solution (Domain / Application / Infrastructure / Web) with central package management, strict-warnings build, artifacts output, optional .NET Aspire, IEndpointGroup auto-mapping, and ProblemDetails exception handling — i.e. the backend layout used by the Mabhas19 reference project.
---

# Scaffold a .NET 10 Clean Architecture Solution

Produces a 4-layer solution (`Domain`, `Application`, `Infrastructure`, `Web`) plus optional Aspire
`AppHost`/`ServiceDefaults`, with the build conventions, endpoint auto-mapping, and exception handling
from the reference project. Replace every `<PLACEHOLDER>` token (e.g. `<RootName>` = `Mabhas19`,
`<DbName>` = `Mabhas19Db`) with your project's names.

## Workflow

### 1. Create the solution and the four layer projects

A `.slnx` (XML solution) is used by the reference repo. Build/test target the `.slnx`.

```bash
dotnet new sln -n <RootName> --format slnx           # produces <RootName>.slnx
dotnet new classlib  -o src/Domain         -f net10.0
dotnet new classlib  -o src/Application    -f net10.0
dotnet new classlib  -o src/Infrastructure -f net10.0
dotnet new web       -o src/Web            -f net10.0
dotnet sln <RootName>.slnx add src/Domain src/Application src/Infrastructure src/Web
```

Reference direction (dependencies point inward — Web is the composition root):

```bash
dotnet add src/Application    reference src/Domain
dotnet add src/Infrastructure reference src/Application
dotnet add src/Web            reference src/Application src/Infrastructure
```

### 2. `Directory.Build.props` (repo root) — shared build conventions

Output goes to `./artifacts/` (not per-project `bin`/`obj`). `TreatWarningsAsErrors` is on; NuGet-audit
advisories on transitive template packages are demoted to warnings so the strict build still passes.

```xml
<!-- See https://aka.ms/dotnet/msbuild/customize for more details on customizing your build -->
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
    <!-- NU1608: transitive version conflicts from preview packages.
         NU1902/NU1903: NuGet audit advisories on transitive template/SDK packages
         (OpenTelemetry, System.Security.Cryptography.Xml). Kept as warnings, not errors. -->
    <WarningsNotAsErrors>NU1608;NU1902;NU1903</WarningsNotAsErrors>
    <ArtifactsPath>$(MSBuildThisFileDirectory)artifacts</ArtifactsPath>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
  </PropertyGroup>
</Project>
```

> .NET 10 turns several deprecations into errors. Use the new API names (e.g. `KnownIPNetworks`,
> not `KnownNetworks` in `ForwardedHeadersOptions`).

### 3. `Directory.Packages.props` (repo root) — central package management

Versions live centrally; project `.csproj` files reference packages **without** a `Version`.

```xml
<Project>
  <PropertyGroup>
    <ManagePackageVersionsCentrally>true</ManagePackageVersionsCentrally>
  </PropertyGroup>
  <ItemGroup>
    <PackageVersion Include="Ardalis.GuardClauses" Version="5.0.0" />
    <PackageVersion Include="AutoMapper" Version="16.1.1" />
    <PackageVersion Include="FluentValidation.DependencyInjectionExtensions" Version="12.1.1" />
    <PackageVersion Include="MediatR" Version="12.5.0" />
    <PackageVersion Include="Microsoft.EntityFrameworkCore" Version="10.0.5" />
    <PackageVersion Include="Microsoft.EntityFrameworkCore.Design" Version="10.0.5" />
    <PackageVersion Include="Microsoft.AspNetCore.Identity.EntityFrameworkCore" Version="10.0.5" />
    <PackageVersion Include="Microsoft.AspNetCore.OpenApi" Version="10.0.5" />
    <PackageVersion Include="Scalar.AspNetCore" Version="2.13.13" />
    <!-- + your provider package, e.g. Microsoft.EntityFrameworkCore.SqlServer 10.0.5 -->
  </ItemGroup>
</Project>
```

In each `.csproj`, add references with no version, e.g. in `src/Application/Application.csproj`:

```xml
<ItemGroup>
  <PackageReference Include="AutoMapper" />
  <PackageReference Include="FluentValidation.DependencyInjectionExtensions" />
  <PackageReference Include="MediatR" />
  <PackageReference Include="Ardalis.GuardClauses" />
</ItemGroup>
```

> **MediatR 13.0+ needs a commercial license; pin to 12.5.0 (Apache-2.0, last free) — ADR-002.**
> (MediatR.Contracts stays 2.0.1.)

### 4. (Optional) Add .NET Aspire orchestration

Add two projects: `ServiceDefaults` (telemetry/health/service-discovery, referenced by `Web`) and
`AppHost` (the orchestrator).

```bash
dotnet new aspire-servicedefaults -o src/ServiceDefaults -f net10.0
dotnet new aspire-apphost        -o src/AppHost          -f net10.0
dotnet sln <RootName>.slnx add src/ServiceDefaults src/AppHost
dotnet add src/Web reference src/ServiceDefaults
dotnet add src/AppHost reference src/Web
```

`src/AppHost/Program.cs` wires the DB resource and the Web project (constant names like
`Services.Database` live in a shared `Services` static class):

```csharp
var builder = DistributedApplication.CreateBuilder(args);

var databaseServer = builder
    .AddSqlServer(Services.DatabaseServer)
    .WithLifetime(ContainerLifetime.Persistent)
    .AddDatabase(Services.Database);          // <DbName>

builder.AddProject<Projects.Web>(Services.WebApi)
    .WithReference(databaseServer)
    .WaitFor(databaseServer)
    .WithExternalHttpEndpoints();

builder.Build().Run();
```

`src/Web/Program.cs` opts in with `builder.AddServiceDefaults();` and `app.MapDefaultEndpoints();`.

> **Aspire namespace clash:** if you name an Application sub-namespace `Projects` (e.g.
> `<RootName>.Application.Projects`), it shadows Aspire's generated global `Projects` namespace in
> functional tests — qualify the generated one as `global::Projects.TestAppHost`.

### 5. `IEndpointGroup` auto-mapping (Web layer)

Endpoints are Minimal-API handler classes auto-discovered by reflection and mounted at `/api/{ClassName}`.
Create `src/Web/Infrastructure/IEndpointGroup.cs`:

```csharp
namespace <RootName>.Web.Infrastructure;

public interface IEndpointGroup
{
    static virtual string? RoutePrefix => null;            // override for custom/nested paths
    static abstract void Map(RouteGroupBuilder groupBuilder);
}
```

And the discovery extension `src/Web/Infrastructure/WebApplicationExtensions.cs`:

```csharp
public static WebApplication MapEndpoints(this WebApplication app, Assembly assembly)
{
    var endpointGroupTypes = assembly.GetExportedTypes()
        .Where(t => t is { IsAbstract: false, IsInterface: false }
                 && t.IsAssignableTo(typeof(IEndpointGroup)));

    foreach (var type in endpointGroupTypes)
    {
        var groupName = type.Name;
        var routePrefix = type.GetProperty(nameof(IEndpointGroup.RoutePrefix))
            ?.GetValue(null) as string ?? $"/api/{groupName}";
        var group = app.MapGroup(routePrefix).WithTags(groupName);
        type.GetMethod(nameof(IEndpointGroup.Map))!.Invoke(null, [group]);
    }
    return app;
}
```

(Optionally add `MapGet`/`MapPost`/… overloads in `EndpointRouteBuilderExtensions` that call
`.WithName(handler.Method.Name)` so handler names become OpenAPI `operationId`s. See the
`add-endpoint-group` skill for writing the groups themselves.)

### 6. Exception handling → RFC 9110 ProblemDetails

Use Ardalis `Guard.Against.NotFound(...)` for 404s and a typed `ForbiddenAccessException` for 403s, then
translate them in an `IExceptionHandler`. Create `src/Web/Infrastructure/ProblemDetailsExceptionHandler.cs`:

```csharp
public class ProblemDetailsExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception ex, CancellationToken ct)
    {
        var (status, problem) = ex switch
        {
            // app's ValidationException (see add-cqrs-usecase) → 400 with field errors
            ValidationException ve => (StatusCodes.Status400BadRequest,
                (ProblemDetails)new ValidationProblemDetails(ve.Errors) { Status = 400 }),
            NotFoundException ne => (StatusCodes.Status404NotFound,
                new ProblemDetails { Status = 404, Detail = ne.Message }),
            UnauthorizedAccessException => (StatusCodes.Status401Unauthorized, new ProblemDetails { Status = 401 }),
            ForbiddenAccessException => (StatusCodes.Status403Forbidden, new ProblemDetails { Status = 403 }),
            _ => (-1, null)                                 // unknown → fall through to default middleware
        };
        if (problem is null) return false;
        ctx.Response.StatusCode = status;
        await ctx.Response.WriteAsJsonAsync(problem, ct);
        return true;
    }
}
```

Register it in `AddWebServices` (`builder.Services.AddExceptionHandler<ProblemDetailsExceptionHandler>();`)
and enable it in `Program.cs` with `app.UseExceptionHandler(options => { });`.

### 7. Compose the pipeline in `src/Web/Program.cs`

```csharp
var builder = WebApplication.CreateBuilder(args);

builder.AddServiceDefaults();          // Aspire (optional)
builder.AddApplicationServices();      // MediatR + FluentValidation + AutoMapper (Application/DependencyInjection.cs)
builder.AddInfrastructureServices();   // EF Core + Identity + your services (Infrastructure/DependencyInjection.cs)
builder.AddWebServices();              // CORS, rate limiting, OpenAPI, ProblemDetails handler

var app = builder.Build();
app.UseExceptionHandler(options => { });
app.MapOpenApi();
app.MapScalarApiReference();           // Scalar docs at /scalar
app.MapDefaultEndpoints();             // Aspire health endpoints (optional)
app.MapEndpoints(typeof(Program).Assembly);   // <- IEndpointGroup auto-mapping
app.Run();

public partial class Program;          // exposes Program to functional tests
```

`Application/DependencyInjection.cs` registers the cross-cutting pieces from the executing assembly:

```csharp
public static void AddApplicationServices(this IHostApplicationBuilder builder)
{
    builder.Services.AddAutoMapper(cfg => cfg.AddMaps(Assembly.GetExecutingAssembly()));
    builder.Services.AddValidatorsFromAssembly(Assembly.GetExecutingAssembly());
    builder.Services.AddMediatR(cfg =>
    {
        cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly());
        cfg.AddOpenBehavior(typeof(ValidationBehaviour<,>));   // + Authorization/Logging/Performance behaviours
    });
}
```

## Verification

```bash
dotnet build <RootName>.slnx           # must succeed with TreatWarningsAsErrors=true
```

- Confirm build artifacts land under `./artifacts/` (not `src/*/bin`).
- Run `dotnet run --project src/Web` and open `http://localhost:5000/scalar` — every `IEndpointGroup`
  class appears as a tag with its routes under `/api/{ClassName}`.
- Hit a route that triggers `Guard.Against.NotFound` and confirm a `404` ProblemDetails JSON body
  (and a missing-validation request returns `400` with a per-field `errors` map).
