# Backend: Clean Architecture

The `<PLACEHOLDER>` backend is a .NET 10 Clean Architecture solution (based on the Jason
Taylor template + .NET Aspire). This guide explains the four layers and the rules between
them, the MediatR pipeline, and gives copy-paste recipes for adding the things you add
most often.

Solution file: `<PLACEHOLDER>.slnx`. Build to `./artifacts/` (see `coding-standards.md`).

---

## 1. The four layers (`src/`)

```
Domain          ← entities, value objects, domain services, constants, enums. No deps.
Application     ← CQRS use cases (MediatR), validators, AutoMapper, service *interfaces*.
                  Depends on Domain only.
Infrastructure  ← EF Core (SQL Server), Identity, and concrete service *implementations*.
                  Depends on Application + Domain.
Web             ← Minimal-API endpoints, DI wiring, OpenAPI. Depends on all of the above.
```

### Dependency rule (one direction, inward)
- **Domain** depends on nothing. It holds the pure business logic — entities like
  `Project`, `Assessment`, `Subscription`, plus domain services (e.g. the Section 19
  calculators). Keep numerically-sensitive domain logic identical to its spec; it is
  unit-tested.
- **Application** depends only on Domain. It defines *what the app does* (commands/queries)
  and the *contracts* for external concerns (`IFileStorage`, `ISubscriptionService`,
  `IReportGenerator`, …) in `Application/Common/Interfaces`. It never references EF
  provider types or `Web`.
- **Infrastructure** implements those interfaces (e.g. `MinioFileStorage : IFileStorage`)
  and owns `ApplicationDbContext`. It depends on Application + Domain.
- **Web** is the entry point: it discovers endpoints, wires DI, and sends MediatR requests.
  Endpoints contain almost no logic — they `sender.Send(command)` and shape the HTTP
  result.

Application talks to the database through the `IApplicationDbContext` interface (in
Application), whose implementation (`ApplicationDbContext`) lives in Infrastructure. That
is how Application stays provider-agnostic:

```csharp
public interface IApplicationDbContext
{
    DbSet<Project> Projects { get; }
    DbSet<Assessment> Assessments { get; }
    DbSet<AssessmentReport> AssessmentReports { get; }
    DbSet<Subscription> Subscriptions { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}
```

### Composition root
`src/Web/Program.cs` builds the host and calls each layer's DI extension:

```csharp
builder.AddApplicationServices();      // Application/DependencyInjection.cs
builder.AddInfrastructureServices();   // Infrastructure/DependencyInjection.cs → AddMabhas19Services
builder.AddWebServices();              // Web/DependencyInjection.cs (CORS, rate limit, OpenAPI)
...
await app.InitialiseDatabaseAsync();   // migrate + seed on startup
app.MapEndpoints(typeof(Program).Assembly);   // auto-map all IEndpointGroup
```

---

## 2. MediatR pipeline behaviors

Application registers MediatR with an ordered pipeline (`Application/DependencyInjection.cs`):

```csharp
builder.Services.AddMediatR(cfg => {
    cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly());
    cfg.AddOpenRequestPreProcessor(typeof(LoggingBehaviour<>));   // logs each request
    cfg.AddOpenBehavior(typeof(UnhandledExceptionBehaviour<,>));  // logs unhandled errors
    cfg.AddOpenBehavior(typeof(AuthorizationBehaviour<,>));       // enforces [Authorize]
    cfg.AddOpenBehavior(typeof(ValidationBehaviour<,>));          // runs FluentValidation
    cfg.AddOpenBehavior(typeof(PerformanceBehaviour<,>));         // warns on slow requests
});
```

What you get for free on every command/query:
- **Authorization** — if the request type carries `[Authorize]`
  (`Application/Common/Security/AuthorizeAttribute.cs`), the behaviour requires an
  authenticated user (`IUser.Id != null` → else `UnauthorizedAccessException`) and checks
  any `Roles`/`Policy` (→ `ForbiddenAccessException`).
- **Validation** — all `IValidator<TRequest>` are run; failures throw the app
  `ValidationException` (400 with field errors).
- **Logging / performance / unhandled-exception** logging.

> Note: this is request-level authorization (coarse). Endpoints can *also* require auth at
> the route (`groupBuilder.RequireAuthorization(...)`), and handlers do *resource* checks
> (`project.OwnerId != _user.Id → ForbiddenAccessException`). Use all three as appropriate.

---

## 3. Recipe: add an entity (+ EF config + migration)

**a. Domain entity** — `src/Domain/Entities/Widget.cs`. Inherit `BaseAuditableEntity`
(gives `Id`, `Created`, `CreatedBy`, `LastModified`, …). Use `required` for mandatory
fields.

```csharp
namespace <PLACEHOLDER>.Domain.Entities;

public class Widget : BaseAuditableEntity
{
    public required string Name { get; set; }
    public int OwnerId { get; set; }
    public string? Notes { get; set; }
}
```

**b. Expose it on the context** — add a `DbSet` to **both**
`Application/Common/Interfaces/IApplicationDbContext.cs` and the concrete
`ApplicationDbContext` (Infrastructure).

```csharp
DbSet<Widget> Widgets { get; }   // interface + implementation
```

**c. EF configuration** — `src/Infrastructure/Data/Configurations/WidgetConfiguration.cs`.
This is where column types, indexes, and relationships live (kept out of the entity).

```csharp
public class WidgetConfiguration : IEntityTypeConfiguration<Widget>
{
    public void Configure(EntityTypeBuilder<Widget> builder)
    {
        builder.Property(w => w.Name).HasMaxLength(200).IsRequired();
        builder.HasIndex(w => w.OwnerId);
    }
}
```

Real example (`AssessmentConfiguration`): JSON columns are stored as SQL Server
`nvarchar(max)`, an enum is persisted as `int`, and a one-to-one is enforced with a unique
index — **not** `jsonb` (that is PostgreSQL; see `gotchas.md`):

```csharp
builder.Property(a => a.InputJson).HasColumnType("nvarchar(max)").IsRequired();
builder.Property(a => a.Status).HasConversion<int>();
builder.HasIndex(a => a.ProjectId).IsUnique();
builder.HasMany(a => a.Reports).WithOne(r => r.Assessment)
       .HasForeignKey(r => r.AssessmentId).OnDelete(DeleteBehavior.Cascade);
```

Configurations are applied by `ApplyConfigurationsFromAssembly` in `ApplicationDbContext`,
so just creating the class is enough.

**d. Migration** — the `dotnet-ef` global tool **must** match EF Core 10:

```bash
dotnet tool update -g dotnet-ef --version "10.0.*"
dotnet ef migrations add AddWidget \
  --project src/Infrastructure --startup-project src/Web --output-dir Data/Migrations
```

Migrations are applied automatically on API startup by `ApplicationDbContextInitialiser`
(`MigrateAsync()`), so you do not run `database update` manually for local/dev.

---

## 4. Recipe: add a CQRS command/query (+ validator + AutoMapper)

Folder layout (mirror the `Projects` feature):

```
Application/Widgets/
  WidgetDto.cs
  Commands/CreateWidget/CreateWidget.cs
  Commands/CreateWidget/CreateWidgetCommandValidator.cs
  Queries/GetWidgets/GetWidgets.cs
```

**Command + handler** in one file. Add `[Authorize]` if it needs a signed-in user;
inject `IUser` to get the caller. Note constructor injection of `IApplicationDbContext`.

```csharp
[Authorize]
public record CreateWidgetCommand : IRequest<int>
{
    public string Name { get; init; } = string.Empty;
    public string? Notes { get; init; }
}

public class CreateWidgetCommandHandler : IRequestHandler<CreateWidgetCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user;

    public CreateWidgetCommandHandler(IApplicationDbContext context, IUser user)
    {
        _context = context;
        _user = user;
    }

    public async Task<int> Handle(CreateWidgetCommand request, CancellationToken ct)
    {
        var entity = new Widget { Name = request.Name, Notes = request.Notes, OwnerId = ... };
        _context.Widgets.Add(entity);
        await _context.SaveChangesAsync(ct);
        return entity.Id;
    }
}
```

**Validator** — FluentValidation, auto-discovered (`AddValidatorsFromAssembly`) and run by
`ValidationBehaviour`. Just inherit `AbstractValidator<T>`:

```csharp
public class CreateWidgetCommandValidator : AbstractValidator<CreateWidgetCommand>
{
    public CreateWidgetCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
    }
}
```

**Query + DTO + AutoMapper nested `Mapping : Profile`.** The mapping is declared as a
**private nested `Mapping` class inside the DTO** (the template's convention; profiles are
auto-registered via `AddMaps`). Read queries use `.AsNoTracking().ProjectTo<TDto>(...)`:

```csharp
// WidgetDto.cs
public class WidgetDto
{
    public int Id { get; init; }
    public string Name { get; init; } = string.Empty;
    public string? Notes { get; init; }

    private class Mapping : Profile
    {
        public Mapping() => CreateMap<Widget, WidgetDto>();
    }
}

// GetWidgets.cs
[Authorize]
public record GetWidgetsQuery : IRequest<IReadOnlyList<WidgetDto>>;

public class GetWidgetsQueryHandler : IRequestHandler<GetWidgetsQuery, IReadOnlyList<WidgetDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;
    public GetWidgetsQueryHandler(IApplicationDbContext context, IMapper mapper)
        => (_context, _mapper) = (context, mapper);

    public async Task<IReadOnlyList<WidgetDto>> Handle(GetWidgetsQuery request, CancellationToken ct)
        => await _context.Widgets.AsNoTracking()
            .ProjectTo<WidgetDto>(_mapper.ConfigurationProvider)
            .ToListAsync(ct);
}
```

For computed/renamed members use `.ForMember(...)` (see `ProjectDto.Mapping`, which maps an
enum to string and a computed building-group label).

---

## 5. Recipe: add an endpoint group (auto-mapped at `/api/{ClassName}`)

Endpoints are Minimal-API. A class implementing `IEndpointGroup`
(`src/Web/Infrastructure/IEndpointGroup.cs`) is auto-discovered by
`MapEndpoints(...)` and mounted at **`/api/{ClassName}`** with a matching OpenAPI tag. The
handler **method name** becomes the OpenAPI `operationId` (used for client generation).

```csharp
namespace <PLACEHOLDER>.Web.Endpoints;

public class Widgets : IEndpointGroup            // → /api/Widgets
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization();     // whole group needs auth

        groupBuilder.MapGet(GetWidgets);         // GET  /api/Widgets
        groupBuilder.MapGet(GetWidget, "{id}");  // GET  /api/Widgets/{id}
        groupBuilder.MapPost(CreateWidget);      // POST /api/Widgets
        groupBuilder.MapPut(UpdateWidget, "{id}");    // PUT    requires a pattern
        groupBuilder.MapDelete(DeleteWidget, "{id}"); // DELETE requires a pattern
    }

    public static async Task<Ok<IReadOnlyList<WidgetDto>>> GetWidgets(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetWidgetsQuery()));

    public static async Task<Created<int>> CreateWidget(ISender sender, CreateWidgetCommand command)
    {
        var id = await sender.Send(command);
        return TypedResults.Created($"/api/Widgets/{id}", id);
    }
}
```

Rules and patterns to follow:
- Handlers are **`static`** and inject services as parameters; the request body binds from
  the last complex parameter. Use `TypedResults` and `Results<T1, T2>` for typed responses.
- `MapGet`/`MapPost` take an optional pattern; **`MapPut`/`MapPatch`/`MapDelete` require
  one** (resource-level, almost always `"{id}"`). These overloads live in
  `EndpointRouteBuilderExtensions` and auto-name the endpoint.
- Gate the group with `RequireAuthorization()` for any signed-in user, or
  `RequireAuthorization(p => p.RequireRole(Roles.Administrator))` for admin-only (see the
  `Admin` group).
- **Custom path:** override `public static string? RoutePrefix => "/api/custom"` on the
  class for nested/versioned routes.
- Keep endpoints thin — push logic into the MediatR handler. Resource-not-found / wrong-
  owner is handled inside the handler via `Guard.Against.NotFound` / `ForbiddenAccessException`.

---

## 6. Recipe: add a service interface + Infrastructure implementation + DI

**a. Interface** in Application — `src/Application/Common/Interfaces/INotifier.cs`:

```csharp
namespace <PLACEHOLDER>.Application.Common.Interfaces;

public interface INotifier
{
    Task NotifyAsync(string userId, string message, CancellationToken ct = default);
}
```

**b. Implementation** in Infrastructure — `src/Infrastructure/Notifications/Notifier.cs`.
Bind config via a strongly-typed options class with a `SectionName` constant (see
`MinioOptions`, `OtpOptions`).

```csharp
public class NotifierOptions { public const string SectionName = "Notifications"; public string? ApiKey { get; set; } }

public class Notifier : INotifier
{
    private readonly NotifierOptions _options;
    public Notifier(IOptions<NotifierOptions> options) => _options = options.Value;
    public Task NotifyAsync(string userId, string message, CancellationToken ct = default) { /* ... */ }
}
```

**c. Register** in `Infrastructure/DependencyInjection.cs` inside `AddMabhas19Services`:

```csharp
services.Configure<NotifierOptions>(config.GetSection(NotifierOptions.SectionName));
services.AddScoped<INotifier, Notifier>();
// HTTP-calling services use a typed client instead:
// services.AddHttpClient<INotifier, Notifier>();
```

Lifetime guidance from this project: `AddScoped` for anything touching the DbContext or
per-request state (`SubscriptionService`, `OtpService`); `AddSingleton` for stateless
clients (`IMinioClient`); `AddHttpClient<TInterface, TImpl>` for services that call out over
HTTP (`SmsSender`, `NezamMohandesiProjectProvider`).

Now any handler can inject `INotifier` through its constructor.
