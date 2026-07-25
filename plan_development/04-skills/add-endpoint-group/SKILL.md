---
name: add-endpoint-group
description: Use when adding a new group of Minimal-API endpoints to a .NET Clean Architecture backend that uses the `IEndpointGroup` convention — a class auto-mapped at `/api/{ClassName}`, with handlers that send MediatR requests via ISender, return typed results (TypedResults / Results<...>), and optionally require a role with RequireRole(Administrator).
---

# Add an `IEndpointGroup`

Endpoint groups are Minimal-API handler classes auto-discovered by `MapEndpoints(...)` and mounted at
`/api/{ClassName}` (the class name *is* the route prefix and the OpenAPI tag — see
`scaffold-clean-architecture` for the discovery mechanism). Each handler is a `static` method that
delegates to a MediatR request via `ISender` (or calls a service directly) and returns a **typed
result**. Replace `<RootName>` and `<Group>` (the PascalCase resource, e.g. `Projects`).

## Workflow

### 1. Create the group class

File: `src/Web/Endpoints/<Group>.cs`. Implement `IEndpointGroup` and register handlers in `Map`. The
custom `MapGet`/`MapPost`/… overloads take the handler first and an **optional** route pattern; they set
`.WithName(handler.Method.Name)` so the method name becomes the OpenAPI `operationId`.

```csharp
using <RootName>.Application.<Group>;
using <RootName>.Application.<Group>.Commands.Create<Thing>;
using <RootName>.Application.<Group>.Queries.Get<Things>;
using Microsoft.AspNetCore.Http.HttpResults;

namespace <RootName>.Web.Endpoints;

public class <Group> : IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization();           // whole group needs a bearer token

        groupBuilder.MapGet(Get<Things>);              // GET  /api/<Group>
        groupBuilder.MapGet(Get<Thing>, "{id}");       // GET  /api/<Group>/{id}
        groupBuilder.MapPost(Create<Thing>);           // POST /api/<Group>
        groupBuilder.MapPut(Update<Thing>, "{id}");    // PUT  — pattern REQUIRED for PUT/PATCH/DELETE
        groupBuilder.MapDelete(Delete<Thing>, "{id}");
    }

    public static async Task<Ok<IReadOnlyList<<Thing>Dto>>> Get<Things>(ISender sender)
        => TypedResults.Ok(await sender.Send(new Get<Things>Query()));

    public static async Task<Created<int>> Create<Thing>(ISender sender, Create<Thing>Command command)
    {
        var newId = await sender.Send(command);
        return TypedResults.Created($"/api/<Group>/{newId}", newId);
    }

    public static async Task<Results<NoContent, BadRequest>> Update<Thing>(
        ISender sender, int id, Update<Thing>Command command)
    {
        if (id != command.Id) return TypedResults.BadRequest();   // route/body id mismatch
        await sender.Send(command);
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> Delete<Thing>(ISender sender, int id)
    {
        await sender.Send(new Delete<Thing>Command(id));
        return TypedResults.NoContent();
    }
}
```

> No registration step is needed — `app.MapEndpoints(typeof(Program).Assembly)` in `Program.cs`
> discovers the class and mounts it under `/api/<Group>` automatically.

### 2. Use typed results (not `IResult`)

Return concrete `TypedResults.*` types so the response is reflected in OpenAPI and typed-client output:

- Single value: `Ok<TDto>`, `Created<TId>`, `NoContent`.
- Multiple outcomes: `Results<Ok<TDto>, NotFound>` and branch with `TypedResults.Ok(...)` /
  `TypedResults.NotFound()`.

```csharp
public static async Task<Results<Ok<<Thing>Dto>, NotFound>> Get<Thing>(ISender sender, int id)
{
    var result = await sender.Send(new Get<Thing>ByIdQuery(id));
    return result is null ? TypedResults.NotFound() : TypedResults.Ok(result);
}
```

(404/403/400 thrown from handlers — `Guard.Against.NotFound`, `ForbiddenAccessException`,
validation failures — are already converted to ProblemDetails by `ProblemDetailsExceptionHandler`, so you
only branch on outcomes you choose to model explicitly.)

### 3. Gate endpoints by role where needed

For an admin-only group, require the role for the whole group in `Map`. The role constant lives in
`Domain/Constants` (`Roles.Administrator`):

```csharp
using <RootName>.Domain.Constants;

public class Admin : IEndpointGroup
{
    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.RequireAuthorization(policy => policy.RequireRole(Roles.Administrator));

        groupBuilder.MapGet(GetUsers, "users");        // GET /api/Admin/users
        groupBuilder.MapPost(CreateUser, "users");
        groupBuilder.MapPut(SetUserRole, "users/{id}/role");
    }
    // ... handlers
}
```

To gate a single endpoint instead of the whole group, chain `.RequireAuthorization(p => p.RequireRole(...))`
onto that one `Map*` call.

### 4. (Optional) Custom or nested route prefix

By default the prefix is `/api/{ClassName}`. To override (e.g. `/api/Auth/otp/...`), add the static
`RoutePrefix` member:

```csharp
public class Auth : IEndpointGroup
{
    public static string? RoutePrefix => "/api/Auth";
    // ...
}
```

## Verification

```bash
dotnet build <RootName>.slnx
```

- Run `dotnet run --project src/Web` and open `/scalar`: the new class appears as a tag, routes are under
  `/api/<Group>`, and each operation's `operationId` matches its handler method name.
- Call an endpoint without a bearer token → `401`; with a non-admin token on a `RequireRole(Administrator)`
  route → `403`.
- Exercise the `Results<...>` branches (e.g. a missing id → `404`, an id mismatch on PUT → `400`).
