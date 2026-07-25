# Subscriptions (account gate; no enforced project cap)

`<PLACEHOLDER>` keeps a per-user **subscription** record, but the per-user **project cap is no
longer enforced** — active users may create **unlimited** projects. Every registered user gets
a **Free** plan; the only thing enforced server-side at create time is that the
subscription/account is **active**. `MaxProjects` is retained on the record for **admin display
only** (admins can still view/set it, but it is not used to block creation). The matching
**user-facing subscription UI is hidden** in the clients.

> Historically the Free plan capped projects at **5** (see ADR-007, superseded in part by the
> "remove project cap" ADR). The cap was removed; the recipe in §5 shows how to re-introduce an
> enforced quota if a future project needs one.

---

## 1. The model (Domain)

`Domain/Entities/Subscription.cs`:

```csharp
public class Subscription : BaseAuditableEntity
{
    public const int DefaultMaxProjects = 5;          // seeded value; NOT enforced

    public required string UserId { get; set; }
    public SubscriptionPlan Plan { get; set; } = SubscriptionPlan.Free;
    public int MaxProjects { get; set; } = DefaultMaxProjects;
    public DateTimeOffset? ValidFrom { get; set; }
    public DateTimeOffset? ValidTo { get; set; }
    public bool IsActive { get; set; } = true;
}
```

- `MaxProjects` is retained for **admin display only** — it no longer caps creation.
- `Plan` is an enum (`Free`, …, `Enterprise`).
- `IsActive` is the only gate enforced at create time; `ValidFrom`/`ValidTo` carry the validity window.

The admin seed gives the administrator an `Enterprise` plan in `ApplicationDbContextInitialiser`.

---

## 2. Enforcement: `ISubscriptionService.EnsureCanCreateProjectAsync`

Contract (`Application/Common/Interfaces/ISubscriptionService.cs`):

```csharp
public interface ISubscriptionService
{
    Task<Subscription> GetOrCreateAsync(string userId, CancellationToken ct = default);
    Task EnsureCanCreateProjectAsync(string userId, CancellationToken ct = default);
}
```

`Infrastructure/Subscriptions/SubscriptionService.cs`:

- **`GetOrCreateAsync`** — returns the user's subscription, **lazily creating** a default
  Free plan (`IsActive = true`) if none exists. So a user never has "no subscription".
- **`EnsureCanCreateProjectAsync`** — the guard. It loads (or creates) the subscription and
  **throws the app `ValidationException` under the `"Subscription"` key only when the account
  is inactive**. There is **no project-count check** — active users create unlimited projects:

```csharp
public async Task EnsureCanCreateProjectAsync(string userId, CancellationToken ct = default)
{
    var sub = await GetOrCreateAsync(userId, ct);

    if (!sub.IsActive)
        Throw("حساب کاربری شما فعال نیست.");                  // "your account is not active"

    // The per-user project cap has been removed — active users may create unlimited
    // projects. (MaxProjects is kept on the record for admin display only.)
}

private static void Throw(string message)
{
    var ex = new ValidationException();                       // app exception (aliased)
    ex.Errors["Subscription"] = new[] { message };
    throw ex;
}
```

> The `"Subscription"` field key is the contract with the frontend: a 400 response carries
> `errors.Subscription = ["..."]`, which the UI surfaces next to the create action (now only on
> the rare inactive-account case). Note this uses the **app** `ValidationException` (with its
> `Errors` dictionary), not FluentValidation's — alias it
> (`using ValidationException = ...Application.Common.Exceptions.ValidationException;`)
> if both are in scope (see `coding-standards.md`).

### Where it is called
At the start of the create-project use case, **before** building the entity
(`Application/Projects/Commands/CreateProject/CreateProject.cs`), and likewise in the
import-project handler:

```csharp
public async Task<int> Handle(CreateProjectCommand request, CancellationToken ct)
{
    var userId = _user.Id!;
    await _subscriptions.EnsureCanCreateProjectAsync(userId, ct);   // ← active-account gate
    // ... create & save the Project ...
}
```

`ProblemDetailsExceptionHandler` turns the thrown `ValidationException` into a
`400 ValidationProblemDetails`, so no special handling is needed in the endpoint.

---

## 3. Reading the current subscription (API)

`GET /api/Subscriptions/me` → `GetMySubscriptionQuery` returns a DTO with the plan, the
(unenforced) `MaxProjects`, and the current project count:

```csharp
public record SubscriptionDto
{
    public string Plan { get; init; } = "";
    public int MaxProjects { get; init; }     // retained for admin display; not enforced
    public int UsedProjects { get; init; }     // current project count
    public bool IsActive { get; init; }
    public DateTimeOffset? ValidTo { get; init; }
}
```

The handler uses `GetOrCreateAsync` (so a brand-new user still gets a sensible response) and
counts projects for `UsedProjects`. The endpoint is **kept** (admin/diagnostic use) but the
**user-facing subscription UI is hidden** — no dashboard subscription nav/cards, no
`/subscription` page (it redirects to the dashboard), and no pricing/plans on the landing page.

---

## 4. Admin: viewing/changing a user's plan

Admins manage subscriptions through `/api/Admin/users/{id}/subscription`
(`PUT`, `Administrator`-gated). `IUserAdminService.UpdateSubscriptionAsync` updates the
user's `Plan`/`MaxProjects`/validity. **Note:** because the project cap is no longer enforced,
changing `MaxProjects` is cosmetic; setting `IsActive = false` is the meaningful gate (it blocks
that user's project creation on the next `EnsureCanCreateProjectAsync` call).

---

## 5. Recipe: (re-)introduce an enforced quota

The active-account gate is the only enforcement today. To add a real per-resource cap back:

1. Use (or add) a cap field on `Subscription` (e.g. `MaxProjects`, `MaxReports`) + a migration
   if new (see `backend-clean-architecture.md`).
2. In `EnsureCanCreate<Resource>Async(userId, ct)`, count the resource and **throw the app
   `ValidationException` under a stable field key** (`ex.Errors["Subscription"] = ...`) when the
   count reaches the cap — e.g. `if (count >= sub.MaxProjects) Throw(...)`.
3. Call it at the start of that resource's create command handler, before persisting.
4. Surface the field key in the client where the resource is created, and re-expose usage in the
   UI (e.g. a dashboard "X of N" card) — these were removed when the cap was dropped.
