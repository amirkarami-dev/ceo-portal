---
name: swap-database-provider
description: Use when swapping the EF Core database provider in a .NET Clean Architecture + Aspire solution (e.g. PostgreSQL <-> SQL Server) — change the provider + Aspire packages, the UseXxx call and the Aspire Enrich call, provider-specific column types (jsonb <-> nvarchar(max)), regenerate migrations, and update every compose/connection string (incl. local-SQL-Server-on-1433 vs container). Verifies with dotnet ef database update + app boot.
---

# Swap the EF Core Database Provider

The provider touches more than one file: NuGet packages, the `DbContext` registration, the Aspire enrich
call + AppHost resource, provider-specific column types in entity configurations, the migrations (which are
provider-specific and must be regenerated), and **every** connection string across dev/local/server compose
files. This skill swaps **to SQL Server** as the worked example (reverse the mapping for the other
direction). Replace `<RootName>`, `<DbName>`.

## Workflow

### 1. Swap the provider + Aspire packages (`Directory.Packages.props`)

Remove the old provider/enrich packages, add the new ones (central package management — pin versions here).

```xml
<!-- For SQL Server: -->
<PackageVersion Include="Microsoft.EntityFrameworkCore.SqlServer" Version="10.0.5" />
<PackageVersion Include="Aspire.Microsoft.EntityFrameworkCore.SqlServer" Version="13.2.0" />
<PackageVersion Include="Aspire.Hosting.SqlServer" Version="13.2.0" />
<!-- Remove the PostgreSQL equivalents:
     Npgsql.EntityFrameworkCore.PostgreSQL, Aspire.Npgsql.EntityFrameworkCore.PostgreSQL,
     Aspire.Hosting.PostgreSQL -->
```

Update the `PackageReference` (no version) in `src/Infrastructure/Infrastructure.csproj` and the
`Aspire.Hosting.*` ref in `src/AppHost/AppHost.csproj` to match.

### 2. Change the `UseXxx` + Aspire enrich call (`Infrastructure/DependencyInjection.cs`)

```csharp
builder.Services.AddDbContext<ApplicationDbContext>((sp, options) =>
{
    options.AddInterceptors(sp.GetServices<ISaveChangesInterceptor>());
    options.UseSqlServer(connectionString);             // was UseNpgsql(...)
    options.ConfigureWarnings(w => w.Ignore(RelationalEventId.PendingModelChangesWarning));
});

builder.EnrichSqlServerDbContext<ApplicationDbContext>();   // was EnrichNpgsqlDbContext<...>
```

And the Aspire AppHost resource (`src/AppHost/Program.cs`):

```csharp
var databaseServer = builder
    .AddSqlServer(Services.DatabaseServer)              // was AddPostgres(...)
    .WithLifetime(ContainerLifetime.Persistent)
    .AddDatabase(Services.Database);                    // <DbName>
```

### 3. Fix provider-specific column types in entity configurations

JSON/large-text and other types differ between providers. Search every `IEntityTypeConfiguration` for
`HasColumnType` (and `.HasConversion`, default value SQL, etc.) and translate:

| PostgreSQL        | SQL Server        |
|-------------------|-------------------|
| `jsonb`           | `nvarchar(max)`   |
| `text`            | `nvarchar(max)`   |
| `timestamptz`     | `datetimeoffset`  |
| `boolean`         | `bit`             |

Example (`src/Infrastructure/Data/Configurations/<Entity>Configuration.cs`) — JSON columns stored as text:

```csharp
builder.Property(a => a.InputJson).HasColumnType("nvarchar(max)").IsRequired();   // was "jsonb"
builder.Property(a => a.ResultJson).HasColumnType("nvarchar(max)").IsRequired();
```

> Grep the Infrastructure project for the old type tokens (`jsonb`, `timestamptz`, …) to be sure none are
> left in a configuration or a raw-SQL migration helper.

### 4. Regenerate migrations (they are provider-specific)

Migration SQL is baked per-provider, so the existing ones won't apply to the new database. Delete and
recreate. Ensure the global `dotnet-ef` tool matches the EF Core major (`10.x`):

```bash
dotnet tool update -g dotnet-ef --version "10.0.*"

# remove the old provider's migrations
rm -r src/Infrastructure/Data/Migrations          # (PowerShell: Remove-Item -Recurse -Force ...)

# recreate against the new provider
dotnet ef migrations add InitialCreate \
  --project src/Infrastructure --startup-project src/Web --output-dir Data/Migrations
```

(If you must preserve history instead of resetting, generate a fresh baseline against the new provider and
migrate data out-of-band — a straight regenerate is only safe when the DB can be recreated.)

### 5. Update every connection string / compose file

Connection-string **syntax differs by provider** and the host differs by environment. Update all of:

- **`appsettings.json`** — keep `ConnectionStrings:<DbName>` empty (filled per environment); confirm the key
  name matches `Services.Database`.
- **dev compose** (`deploy/docker-compose.dev.yml`) — the DB container + port. SQL Server listens on
  **1433**; if a SQL Server is **already running locally on 1433**, either stop it or remap the container
  (e.g. `"14333:1433"`) and point the dev connection string at the remapped port to avoid a clash.
- **local / server compose** — service name + credentials.

SQL Server connection string (server compose talks to the `sqlserver` service on the internal network):

```yaml
ConnectionStrings__<DbName>: "Server=sqlserver,1433;Database=<DbName>;User Id=sa;Password=${MSSQL_SA_PASSWORD};TrustServerCertificate=True;"
```

Local dev (API on the host, DB in the dev container on `localhost:1433`):

```
Server=localhost,1433;Database=<DbName>;User Id=sa;Password=<DevPwd>;TrustServerCertificate=True;
```

SQL Server container env (dev): `ACCEPT_EULA: "Y"`, `MSSQL_SA_PASSWORD: <DevPwd>`, `MSSQL_PID: "Developer"`
(use `Express` for production). On the server the image may be **side-loaded** if `mcr` is blocked — see
`deploy-behind-traefik`.

## Verification

```bash
# 1. Start the new DB
docker compose -f deploy/docker-compose.dev.yml up -d

# 2. The regenerated migration applies cleanly to the new provider
dotnet ef database update --project src/Infrastructure --startup-project src/Web

# 3. Build + boot
dotnet build <RootName>.slnx
dotnet run --project src/Web      # startup runs InitialiseDatabaseAsync (migrate + seed) with no provider error
```

- `dotnet ef database update` completes without a provider/type error (confirms column-type translations).
- The app boots, applies migrations on startup, and seeds roles/admin against the new database.
- Round-trip a JSON-column entity (write then read) to confirm the `nvarchar(max)`/`jsonb` column behaves.
- Grep the repo for the **old** provider tokens (`UseNpgsql`, `Npgsql`, `jsonb`, old connection strings) —
  none should remain.
