# Coding Standards

Style rules for the `<PLACEHOLDER>` codebase — a .NET 10 Clean Architecture backend
(C#) plus a Next.js + Expo TypeScript frontend in an npm-workspaces monorepo. These are
derived from the reference project (Mabhas19). Follow them so the strict build keeps passing.

---

## 1. C# / .NET

### Language & project settings
These are set once in `Directory.Build.props` at the repo root and apply to every `.csproj`:

```xml
<PropertyGroup>
  <TargetFramework>net10.0</TargetFramework>
  <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  <WarningsNotAsErrors>NU1608;NU1902;NU1903</WarningsNotAsErrors>
  <ArtifactsPath>$(MSBuildThisFileDirectory)artifacts</ArtifactsPath>
  <ImplicitUsings>enable</ImplicitUsings>
  <Nullable>enable</Nullable>
</PropertyGroup>
```

- **`ImplicitUsings` is on** — do not add `using System;` etc. Add only the namespaces
  the implicit set does not cover.
- **`Nullable` is on** — annotate reference types (`string?`), use `required` for
  non-null init-only properties, and use `= null!;` only for EF navigation properties.
- **Warnings are errors.** A new unused variable, an obsolete API, or a missing `await`
  will fail the build, not just warn. See the strict-build section below.

### Naming
| Thing | Convention | Example |
|---|---|---|
| Class, record, method, property, enum | `PascalCase` | `CreateProjectCommandHandler`, `TotalScore` |
| Interface | `I` + `PascalCase` | `IFileStorage`, `ISubscriptionService` |
| Private field | `_camelCase` | `_context`, `_user` |
| Local var, parameter | `camelCase` | `userId`, `cancellationToken` |
| Constant | `PascalCase` | `DefaultMaxProjects`, `SectionName` |
| Async method | suffix `Async` | `GetPresignedUrlAsync` |

- One public type per file; file name matches the type.
- CQRS files group the request **and** its handler (and `Result`/DTO records) in one file,
  named after the request (e.g. `CreateProject.cs` holds `CreateProjectCommand` +
  `CreateProjectCommandHandler`). Validators live next to them in their own file
  (`CreateProjectCommandValidator.cs`).

### Records vs classes
- **Commands/queries**: `record` with `init`-only properties (immutable request).
  ```csharp
  public record CreateProjectCommand : IRequest<int>
  {
      public string Title { get; init; } = string.Empty;
      public string? Client { get; init; }
  }
  ```
- **DTOs**: `class` (or `record`) with `init` properties; AutoMapper maps into them.
- **Entities**: `class` (mutable; EF tracks them).
- **Small immutable value tuples** (`GoogleUserInfo`, `GenerateReportResult`): positional `record`.

### Async & EF Core
- Every I/O method takes a `CancellationToken` (default `default`) and passes it down.
- Read queries use `.AsNoTracking()` and project with AutoMapper's `.ProjectTo<T>()`
  instead of fetching entities and mapping in memory.
- Use `FirstOrDefaultAsync`, `CountAsync`, `AnyAsync`, `ToListAsync` — never their sync
  counterparts.

### Dependency injection
- Constructor injection only; assign to `private readonly` fields.
- Register services in the layer's `DependencyInjection.cs` extension (see
  `backend-clean-architecture.md`), not inline.

---

## 2. Error handling (backend)

Errors are expressed as exceptions and translated to HTTP status codes centrally by
`ProblemDetailsExceptionHandler` (`src/Web/Infrastructure`). Throw the right exception;
do **not** build `IResult` error bodies by hand inside handlers.

| Situation | Throw / use | HTTP result |
|---|---|---|
| Entity not found (404) | `Guard.Against.NotFound(id, entity)` (Ardalis.GuardClauses) | 404 ProblemDetails |
| Not the owner / no role (403) | `throw new ForbiddenAccessException()` | 403 |
| Not authenticated (401) | `throw new UnauthorizedAccessException()` | 401 |
| Input/business-rule failure (400) | app `ValidationException` (see below) | 400 ValidationProblemDetails |

For SSO deployments the Web API is a resource server validating OIDC JWT claims (no
bearer-token issuance / `MapIdentityApi`) — see `sso-oidc.md`.

`Guard.Against.NotFound` throws `NotFoundException`; the handler maps it to 404:

```csharp
var project = await _context.Projects
    .Include(p => p.Assessment)
    .FirstOrDefaultAsync(p => p.Id == request.ProjectId, ct);

Guard.Against.NotFound(request.ProjectId, project);   // 404 if null
if (project.OwnerId != _user.Id) throw new ForbiddenAccessException();  // 403
```

### The `ValidationException` ambiguity (important)
There are **two** `ValidationException` types in scope:
- `FluentValidation.ValidationException` (pulled in by a global using),
- `Mabhas19.Application.Common.Exceptions.ValidationException` (the app's — has an
  `Errors` dictionary the exception handler turns into a 400 with field errors).

They are ambiguous. When you need the **app** one, alias it at the top of the file:

```csharp
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;
```

`ValidationBehaviour` and `GenerateReport` already do this. To surface a field error
(e.g. an inactive-account gate or a business rule) use the app exception and set a named key — the frontend
reads errors by field:

```csharp
var ex = new ValidationException();
ex.Errors["Subscription"] = new[] { "You have reached your project limit." };
throw ex;
```

FluentValidation validators throw the app `ValidationException` automatically via the
MediatR `ValidationBehaviour` — you rarely throw it directly for input validation.

---

## 3. TypeScript (web + mobile + shared package)

### General
- `strict: true` everywhere (`tsconfig.json`). No implicit `any`; prefer `unknown` and
  narrow.
- Use `type`-only imports for types: `import type { Project } from "./types"`.
- Prefer `const`; arrow functions for components and helpers.
- 2-space indent, double quotes, no semicolons in the existing code — match the file you
  are editing (ESLint/Prettier-style as configured by `eslint-config-next`).
- Run `npm run lint` (web) / `npm run typecheck` (mobile, shared) before committing.

### Naming
| Thing | Convention | Example |
|---|---|---|
| React component, type, interface | `PascalCase` | `RequireAuth`, `CurrentUser` |
| Hook | `use` + `PascalCase` | `useAuth` |
| Function, variable | `camelCase` | `apiFetch`, `refreshOnce` |
| Constant | `UPPER_SNAKE` or `camelCase` | `OTP_LENGTH`, `API_BASE` |
| File (component) | `kebab-case.tsx` | `require-auth.tsx`, `auth-context.tsx` |

### Errors (frontend)
- The shared fetch wrapper throws a typed `ApiError` (`status`, `body`) on non-2xx.
  Catch it and read `body` for `ValidationProblemDetails.errors` keyed by field.
  ```ts
  try {
    await projectsApi.create(input)
  } catch (e) {
    if (e instanceof ApiError && e.status === 400) { /* show field errors */ }
  }
  ```
- Never swallow errors silently except on logout/refresh (where a network failure is
  non-fatal — see `auth-context.tsx`).

### Imports & navigation (web)
- Import UI from the stable barrel `@/components/ui` — never reach into a primitive's
  file directly.
- Use locale-aware `Link` / `useRouter` / `redirect` from `@/i18n/navigation`, **not**
  `next/link` or `next/navigation` (otherwise the `/en` locale prefix is lost).

---

## 4. The strict build (do not fight it)

`TreatWarningsAsErrors=true` means the smallest warning fails `dotnet build`. .NET 10
also promotes some deprecations to errors.

- **Deprecated APIs are errors.** Example seen in this project: use `KnownIPNetworks`,
  **not** `KnownNetworks`, when configuring `ForwardedHeadersOptions`.
- **NuGet-audit advisories** on transitive template/SDK packages (`OpenTelemetry`,
  `System.Security.Cryptography.Xml`) would otherwise break the build. They are demoted
  from error to warning via `WarningsNotAsErrors` = `NU1608;NU1902;NU1903` in
  `Directory.Build.props`. Only add a code here if it is a genuine transitive advisory
  you cannot fix yet — review and remove when an upstream fix ships.
- Do **not** disable `TreatWarningsAsErrors` to get a build through. Fix the warning.

---

## 5. Build output location

Build artifacts go to **`./artifacts/`** at the repo root (set by `ArtifactsPath` in
`Directory.Build.props`), not the per-project `bin/`/`obj/`. So:
- `artifacts/bin/<Project>/<config>/` for assemblies,
- `artifacts/obj/...` for intermediates.

When you script a build/copy step, point at `artifacts/`, and keep `artifacts/` in
`.gitignore`.
