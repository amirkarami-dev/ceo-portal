---
name: add-cqrs-usecase
description: Use when adding a new application use case (a MediatR command or query) to a .NET Clean Architecture backend — including its FluentValidation validator, an AutoMapper response DTO with a nested `Mapping : Profile`, and wiring it to a Minimal-API endpoint. Covers the `ValidationException` ambiguity gotcha.
---

# Add a CQRS Use Case (MediatR command/query + validator + DTO + endpoint)

Use cases live in the **Application** layer, one folder per feature
(`Application/<Feature>/Commands/<Name>` and `Application/<Feature>/Queries/<Name>`). MediatR,
FluentValidation, and AutoMapper are auto-registered from the Application assembly (see
`scaffold-clean-architecture`), so adding a class is usually all that's required. Replace
`<RootName>` (e.g. `Mabhas19`), `<Feature>` (e.g. `Projects`), `<Name>`, and `<Entity>`.

## Workflow

### 1. Define the command/query and its handler

A command/query is a `record` implementing `IRequest<T>` (or `IRequest` for void). The `[Authorize]`
attribute (from `Application/Common/Security`) makes the `AuthorizationBehaviour` require an
authenticated user. Put the request + handler in one file:
`src/Application/<Feature>/Commands/<Name>/<Name>.cs`.

```csharp
using <RootName>.Application.Common.Interfaces;
using <RootName>.Application.Common.Security;
using <RootName>.Domain.Entities;

namespace <RootName>.Application.<Feature>.Commands.<Name>;

[Authorize]
public record <Name>Command : IRequest<int>           // returns the new id
{
    public string Title { get; init; } = string.Empty;
    public string City { get; init; } = string.Empty;
    public double TotalArea { get; init; }
}

public class <Name>CommandHandler : IRequestHandler<<Name>Command, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _user;                      // current user, injected

    public <Name>CommandHandler(IApplicationDbContext context, IUser user)
    {
        _context = context;
        _user = user;
    }

    public async Task<int> Handle(<Name>Command request, CancellationToken cancellationToken)
    {
        var entity = new <Entity>
        {
            Title = request.Title,
            City = request.City,
            TotalArea = request.TotalArea,
            OwnerId = _user.Id!,
        };

        _context.<Entity>s.Add(entity);
        await _context.SaveChangesAsync(cancellationToken);
        return entity.Id;
    }
}
```

For a **query**, the shape is the same with `IRequest<TResult>`; project to a DTO using AutoMapper's
`ProjectTo` (see step 3) and return a read-only list/single DTO.

> Use `Guard.Against.NotFound(request.Id, entity)` (Ardalis) for 404s and
> `throw new ForbiddenAccessException()` when the entity isn't owned by `_user.Id` — both are translated
> to RFC 9110 ProblemDetails by `ProblemDetailsExceptionHandler` (404 / 403).

### 2. Add the FluentValidation validator

Put it next to the command: `src/Application/<Feature>/Commands/<Name>/<Name>CommandValidator.cs`.
`ValidationBehaviour` runs every validator for the request automatically before the handler.

```csharp
namespace <RootName>.Application.<Feature>.Commands.<Name>;

public class <Name>CommandValidator : AbstractValidator<<Name>Command>
{
    public <Name>CommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().MaximumLength(200);
        RuleFor(x => x.City).NotEmpty().MaximumLength(100);
        RuleFor(x => x.TotalArea).GreaterThanOrEqualTo(0);
    }
}
```

A failed rule produces a `400` ProblemDetails with a per-field `errors` map (keyed by property name).

### 3. Add a response DTO with a nested `Mapping : Profile`

Convention: the AutoMapper profile is a **private nested class** inside the DTO, so the mapping lives
next to the shape it produces. `AddMaps(Assembly...)` discovers it. File:
`src/Application/<Feature>/<Entity>Dto.cs`.

```csharp
using <RootName>.Domain.Entities;

namespace <RootName>.Application.<Feature>;

public class <Entity>Dto
{
    public int Id { get; init; }
    public string Title { get; init; } = string.Empty;
    public string City { get; init; } = string.Empty;
    public string StatusLabel { get; init; } = string.Empty;   // computed/renamed member

    private class Mapping : Profile
    {
        public Mapping()
        {
            CreateMap<<Entity>, <Entity>Dto>()
                // map an enum to its string, a renamed/computed member, etc.
                .ForMember(d => d.StatusLabel, o => o.MapFrom(s => s.Status.ToString()));
        }
    }
}
```

In a query handler, project straight to the DTO:

```csharp
return await _context.<Entity>s
    .AsNoTracking()
    .ProjectTo<<Entity>Dto>(_mapper.ConfigurationProvider)
    .ToListAsync(cancellationToken);
```

### 4. Wire it to an endpoint

Add a line in the relevant `IEndpointGroup` (`src/Web/Endpoints/<Feature>.cs`) that sends the request
via `ISender` and returns a typed result. (See the `add-endpoint-group` skill for creating new groups.)

```csharp
public static async Task<Created<int>> <Name>(ISender sender, <Name>Command command)
{
    var newId = await sender.Send(command);
    return TypedResults.Created($"/api/<Feature>/{newId}", newId);
}
// ...registered in Map(...):  groupBuilder.MapPost(<Name>);
```

## Gotcha: `ValidationException` is ambiguous

`FluentValidation.ValidationException` is brought in by a global using, while the app's own
`<RootName>.Application.Common.Exceptions.ValidationException` (the one carrying the `Errors` dictionary
that becomes the 400 response) has the same simple name. When you reference the app's exception in a
handler or service, **alias it** so the compiler picks the right type:

```csharp
using ApplicationValidationException = <RootName>.Application.Common.Exceptions.ValidationException;
// ...
throw new ApplicationValidationException(/* failures or field/message */);
```

(`ValidationBehaviour` itself throws the app's `ValidationException`; only your own `throw` sites need
the alias.)

## Verification

```bash
dotnet build <RootName>.slnx
dotnet test --filter "FullyQualifiedName~<Name>"     # if you added a handler/validator test
```

- Run `dotnet run --project src/Web`, open `/scalar`, and confirm the new operation appears under the
  `<Feature>` tag with the correct verb/route.
- Send a request that violates a validator rule → expect `400` with an `errors` object keyed by field.
- Send a valid request → expect the success result (e.g. `201 Created` with the new id) and verify the
  row was persisted.
