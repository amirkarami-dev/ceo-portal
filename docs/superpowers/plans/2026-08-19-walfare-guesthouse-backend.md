# مهمانسرا Guesthouse — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the server side of the guesthouse referral service — domain, API, token payment and SMS — so the whole flow works end to end over HTTP before any UI exists.

**Architecture:** A new `WelfareServiceType.Guesthouse` joins the existing welfare model. `WelfareGuesthouse` hangs off a `WelfareService` exactly as `WelfarePool` does; `GuesthouseRequest` holds one stay with its companions. Payment reuses `PaymentTransaction` with a new `TargetType`, reached either by a signed-in member or by an opaque token sent over SMS.

**Tech Stack:** .NET 10, EF Core, MediatR, FluentValidation, Ardalis.GuardClauses, NUnit + Shouldly.

**Spec:** [`docs/superpowers/specs/2026-08-19-walfare-guesthouse-design.md`](../specs/2026-08-19-walfare-guesthouse-design.md)

**Front end:** a separate plan, written once this one lands.

## Global Constraints

- **.NET builds and tests run LOCALLY.** Verified before dispatch on this machine: `dotnet --version` → 10.0.400-preview, `dotnet build src/Domain/Domain.csproj` → 0 errors, `dotnet test tests/Domain.UnitTests` → 18/18 passed, "All projects are up-to-date for restore". `docs/ai/OPERATIONS.md` says builds run on the server; that is about restoring NEW packages, and this plan adds none. Run every command below on this machine. **Task 9 is the exception** — it needs a running API and database, not just a compiler.
- **Enums are numbers on the wire.** The Web host registers no `JsonStringEnumConverter`, so `GuesthouseRequestStatus.Priced` serialises as `1`. Never type a wire enum as a string union.
- **Reuse `JalaliDate.Parse`** from `src/Application/Common/JalaliDate.cs`. Do not write another Jalali converter.
- **Every refusal carries a Persian sentence**, through the `Fail.With(property, message)` helper each walfare file already declares at its top.
- **Person fields are snapshots.** Copy name, national code and mobile onto the row at write time, as `WelfarePoolReservation` does — the letter must keep saying who it was issued to.
- **Admin handlers use `[Authorize(Roles = Roles.AdminOrSuper)]`, never `Roles.Administrator`.** The
  role check compares `role == x` and never trims, so naming `Administrator` alone makes a SuperUser
  behave like an ordinary user — `src/Domain/Constants/Roles.cs` documents this. Every existing
  walfare and analytics handler uses `AdminOrSuper`.
- **Tests use NUnit + Shouldly.** `FluentAssertions` is NOT referenced anywhere in this repo — not in
  `Directory.Packages.props`, not in any test csproj. Write `x.ShouldBe(y)`, `x.ShouldBeTrue()`,
  `Should.Throw<T>(() => ...)`. Never add a new assertion library.
- **A FluentValidation `AbstractValidator<SomeInput>` NEVER RUNS on its own.** `ValidationBehaviour`
  resolves `IValidator<TRequest>` where `TRequest` is the *command*, so an input validator must be
  bridged by a command validator: `public class XCommandValidator : AbstractValidator<XCommand> {
  public XCommandValidator() => RuleFor(x => x.Input).SetValidator(new XInputValidator()); }`.
  `WelfarePools.cs` does exactly this with `CreateWelfarePoolCommandValidator` /
  `UpdateWelfarePoolCommandValidator`. Miss it and the rules are dead code that unit tests still
  pass, because the tests construct the validator directly.
- **Never commit secrets.** SMS credentials come from the existing `Sms` configuration section.
- **Endpoint handler method names are globally unique** and carry the `Walfare` prefix — they become operationIds.

---

### Task 1: Domain entities, EF configuration and migration

**Files:**
- Create: `src/Domain/Walfare/WelfareGuesthouse.cs`
- Create: `src/Domain/Walfare/GuesthouseRequest.cs`
- Modify: `src/Domain/Walfare/WelfareService.cs` (the enum)
- Modify: `src/Infrastructure/Data/Configurations/Walfare/WalfareConfigurations.cs` (append)
- Modify: `src/Infrastructure/Data/ApplicationDbContext.cs`
- Modify: `src/Application/Common/Interfaces/IApplicationDbContext.cs`
- Test: `tests/Domain.UnitTests/Walfare/GuesthouseRequestTests.cs`

**Interfaces:**
- Consumes: nothing.
- Produces: `WelfareGuesthouse`, `GuesthouseRequest`, `GuesthouseCompanion`, `GuesthouseRequestStatus`, `ApplicantGender`, `CompanionRelation`, `GuesthouseRequest.Nights`, `GuesthouseRequest.GuestCount`, and the DbSets `WelfareGuesthouses` and `GuesthouseRequests`.

- [ ] **Step 1: Write the failing test**

Create `tests/Domain.UnitTests/Walfare/GuesthouseRequestTests.cs`:

```csharp
using Shouldly;
using Mabhas19.Domain.Walfare;
using NUnit.Framework;

namespace Mabhas19.Domain.UnitTests.Walfare;

public class GuesthouseRequestTests
{
    [Test]
    public void Nights_counts_the_gap_between_the_two_dates()
    {
        var request = new GuesthouseRequest
        {
            CheckInDate = new DateOnly(2026, 8, 18),
            CheckOutDate = new DateOnly(2026, 8, 21)
        };

        request.Nights.ShouldBe(3);
    }

    [Test]
    public void Nights_is_zero_when_arriving_and_leaving_the_same_day()
    {
        var request = new GuesthouseRequest
        {
            CheckInDate = new DateOnly(2026, 8, 18),
            CheckOutDate = new DateOnly(2026, 8, 18)
        };

        request.Nights.ShouldBe(0);
    }

    [Test]
    public void Nights_never_goes_negative_when_the_dates_are_the_wrong_way_round()
    {
        // Validation refuses this at the door, but a row stored under an older rule
        // must not produce a bill for minus two nights.
        var request = new GuesthouseRequest
        {
            CheckInDate = new DateOnly(2026, 8, 21),
            CheckOutDate = new DateOnly(2026, 8, 19)
        };

        request.Nights.ShouldBe(0);
    }

    [Test]
    public void GuestCount_counts_the_applicant_and_companions_but_not_infants()
    {
        var request = new GuesthouseRequest();
        request.Companions.Add(new GuesthouseCompanion { FullName = "الف", IsInfant = false });
        request.Companions.Add(new GuesthouseCompanion { FullName = "ب", IsInfant = false });
        request.Companions.Add(new GuesthouseCompanion { FullName = "ج", IsInfant = true });

        request.GuestCount.ShouldBe(3);
    }
}
```

- [ ] **Step 2: Run the test and watch it fail**

On the server, from the repo root:

```bash
dotnet test tests/Domain.UnitTests/Domain.UnitTests.csproj --filter GuesthouseRequestTests
```

Expected: FAIL — `The type or namespace name 'GuesthouseRequest' could not be found`.

- [ ] **Step 3: Add the enum member**

In `src/Domain/Walfare/WelfareService.cs`. Do not renumber `PoolTicket` — rows already carry `1`.

```csharp
/// <summary>Kinds of welfare service the org offers.</summary>
public enum WelfareServiceType
{
    PoolTicket = 1,

    /// <summary>مهمانسرا — a referral to stay, priced by the welfare office.</summary>
    Guesthouse = 2
}
```

- [ ] **Step 4: Create the guesthouse entity**

Create `src/Domain/Walfare/WelfareGuesthouse.cs`:

```csharp
using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Walfare;

/// <summary>
/// One مهمانسرا the organisation refers members to. Sits under a <see cref="WelfareService"/>
/// exactly as <see cref="WelfarePool"/> does, so the admin gets the same on/off switch and the same
/// activation window without a second kind of management screen.
/// </summary>
public class WelfareGuesthouse : BaseAuditableEntity
{
    public int ServiceId { get; set; }

    public WelfareService? Service { get; set; }

    /// <summary>«مهمانسرای ...» — printed on the referral letter.</summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>شهرستان.</summary>
    public string City { get; set; } = string.Empty;

    /// <summary>«مسئول محترم مهمانسرای ...» — who the letter is addressed to.</summary>
    public string ManagerName { get; set; } = string.Empty;

    public string Description { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;

    /// <summary>Beds available. NULL means "not tracked", which is every guesthouse today.</summary>
    /// <remarks>
    /// Deliberately unused: this service is a referral, not a booking engine — nothing on the paper
    /// form implies rooms or a calendar. The column exists so that if guesthouses do start filling
    /// up, the rule is an overlap query over data we already hold rather than a migration.
    /// </remarks>
    public int? Capacity { get; set; }

    public ICollection<GuesthouseRequest> Requests { get; set; } = new List<GuesthouseRequest>();
}
```

- [ ] **Step 5: Create the request entity**

Create `src/Domain/Walfare/GuesthouseRequest.cs`:

```csharp
using Mabhas19.Domain.Common;

namespace Mabhas19.Domain.Walfare;

public enum GuesthouseRequestStatus
{
    /// <summary>Created by the member or by an admin. No price yet, nothing to pay.</summary>
    Submitted = 0,

    /// <summary>The admin confirmed it and set the amount. The payment token exists from here.</summary>
    Priced = 1,

    /// <summary>The gateway verified server-to-server. Terminal; the referral letter unlocks.</summary>
    Paid = 2,

    Rejected = 3,

    Cancelled = 4
}

/// <summary>Drives «جناب آقای» / «سرکار خانم» on the referral letter.</summary>
public enum ApplicantGender
{
    Male = 0,
    Female = 1
}

/// <summary>نسبت — the fixed list from the paper form.</summary>
public enum CompanionRelation
{
    Spouse = 0,
    Child = 1,
    Father = 2,
    Mother = 3,
    Brother = 4,
    Sister = 5,
    Other = 6
}

/// <summary>
/// One member's request to stay at a guesthouse, from submission through to a printed referral.
/// </summary>
/// <remarks>
/// The person fields are a SNAPSHOT taken at write time — from <c>WebS_GetEngineerInfo</c> for a
/// member, or typed by an admin for somebody the membership database has never heard of. The letter
/// must keep saying who it was issued to even if the org record changes later.
/// </remarks>
public class GuesthouseRequest : BaseAuditableEntity
{
    public int GuesthouseId { get; set; }

    public WelfareGuesthouse? Guesthouse { get; set; }

    /// <summary>
    /// OIDC subject of the member's auth account. NULL when an admin created this for somebody with
    /// no account — which also means the row can never appear in a "my requests" list, so the SMS
    /// link is that person's only door.
    /// </summary>
    public string? UserId { get; set; }

    public bool CreatedByAdmin { get; set; }

    public GuesthouseRequestStatus Status { get; set; } = GuesthouseRequestStatus.Submitted;

    // ── applicant snapshot ───────────────────────────────────────────────────
    public string FullName { get; set; } = string.Empty;

    /// <summary>کد ملی. NOT unique — an admin may type the same person in twice.</summary>
    public string NationalCode { get; set; } = string.Empty;

    public string MembershipNumber { get; set; } = string.Empty;

    public string Mobile { get; set; } = string.Empty;

    /// <summary>
    /// NULL until the admin sets it. The gender select sits on the OFFICE's half of the paper form,
    /// so a member submitting a request never fills it in; the letter refuses to print without it
    /// rather than guessing from a name.
    /// </summary>
    public ApplicantGender? Gender { get; set; }

    // ── the stay ─────────────────────────────────────────────────────────────
    /// <summary>تاریخ ورود, Jalali as displayed (e.g. <c>1405/05/27</c>).</summary>
    public string CheckInDateJalali { get; set; } = string.Empty;

    /// <summary>تاریخ خروج, Jalali as displayed.</summary>
    public string CheckOutDateJalali { get; set; } = string.Empty;

    /// <summary>Gregorian shadow of <see cref="CheckInDateJalali"/> — every query groups by this.</summary>
    public DateOnly CheckInDate { get; set; }

    public DateOnly CheckOutDate { get; set; }

    // ── pricing ──────────────────────────────────────────────────────────────
    /// <summary>Set by the admin when confirming. 0 until then.</summary>
    public long AmountRials { get; set; }

    public string AdminNote { get; set; } = string.Empty;

    // ── payment ──────────────────────────────────────────────────────────────
    /// <summary>
    /// Opaque bearer token for the SMS link. Minted when the request is priced — never at
    /// submission, which would publish a payable link for an amount nobody has set.
    /// </summary>
    public string? PaymentToken { get; set; }

    public DateTimeOffset? PaymentTokenExpiresUtc { get; set; }

    public int? PaymentTransactionId { get; set; }

    public DateTimeOffset? PaidAtUtc { get; set; }

    /// <summary>
    /// شماره فیش. Filled from the gateway's retrieval reference on success, and editable — some
    /// payments still arrive as a bank transfer the admin enters by hand.
    /// </summary>
    public string ReceiptNumber { get; set; } = string.Empty;

    public ICollection<GuesthouseCompanion> Companions { get; set; } = new List<GuesthouseCompanion>();

    /// <summary>
    /// Nights stayed, derived rather than stored — a stored copy is one more thing that can disagree
    /// with the dates beside it. Never negative.
    /// </summary>
    public int Nights => Math.Max(0, CheckOutDate.DayNumber - CheckInDate.DayNumber);

    /// <summary>The applicant plus companions. Infants are not counted.</summary>
    public int GuestCount => 1 + Companions.Count(c => !c.IsInfant);
}

/// <summary>
/// One name travelling with the applicant.
/// </summary>
/// <remarks>
/// One table, not two. The form separates «اسامی همراهان» from «اسامی کودکان زیر دو سال», but both
/// are just a name — the only real difference is that an infant has no نسبت and is not counted for
/// pricing. A boolean says that in one place; two tables would duplicate every query and every form
/// control to express it.
/// </remarks>
public class GuesthouseCompanion : BaseEntity
{
    public int RequestId { get; set; }

    public GuesthouseRequest? Request { get; set; }

    public string FullName { get; set; } = string.Empty;

    /// <summary>NULL for an infant, who has no نسبت column on the form.</summary>
    public CompanionRelation? Relation { get; set; }

    /// <summary>«کودک زیر دو سال» — listed separately on the form, not counted for pricing.</summary>
    public bool IsInfant { get; set; }
}
```

- [ ] **Step 6: Run the domain test and watch it pass**

```bash
dotnet test tests/Domain.UnitTests/Domain.UnitTests.csproj --filter GuesthouseRequestTests
```

Expected: PASS, 4 tests.

- [ ] **Step 7: Add the EF configuration**

Append to `src/Infrastructure/Data/Configurations/Walfare/WalfareConfigurations.cs`:

```csharp
public class WelfareGuesthouseConfiguration : IEntityTypeConfiguration<WelfareGuesthouse>
{
    public void Configure(EntityTypeBuilder<WelfareGuesthouse> b)
    {
        b.ToTable("WelfareGuesthouses");
        b.Property(x => x.Name).HasMaxLength(200).IsRequired();
        b.Property(x => x.City).HasMaxLength(100).IsRequired();
        b.Property(x => x.ManagerName).HasMaxLength(200);
        b.Property(x => x.Description).HasMaxLength(1000);

        b.HasOne(x => x.Service)
            .WithMany()
            .HasForeignKey(x => x.ServiceId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class GuesthouseRequestConfiguration : IEntityTypeConfiguration<GuesthouseRequest>
{
    public void Configure(EntityTypeBuilder<GuesthouseRequest> b)
    {
        b.ToTable("GuesthouseRequests");
        b.Property(x => x.FullName).HasMaxLength(200).IsRequired();
        // 20, not 10/11: the exact digit count is the validator's job. A column narrow
        // enough to truncate turns an admin's typo into SqlException 8152 at SaveChanges
        // — a 500 with no field-level message, in the admin-entry flow this feature adds.
        b.Property(x => x.NationalCode).HasMaxLength(20).IsRequired();
        b.Property(x => x.MembershipNumber).HasMaxLength(50);
        b.Property(x => x.Mobile).HasMaxLength(20).IsRequired();
        // 30, matching every sibling Jalali column: these can carry a trailing space or an RTL mark.
        b.Property(x => x.CheckInDateJalali).HasMaxLength(30).IsRequired();
        b.Property(x => x.CheckOutDateJalali).HasMaxLength(30).IsRequired();
        // nvarchar(max) cannot be an index key, and "my requests" filters on this.
        b.Property(x => x.UserId).HasMaxLength(100);
        b.HasIndex(x => x.UserId);
        b.Property(x => x.AdminNote).HasMaxLength(1000);
        b.Property(x => x.ReceiptNumber).HasMaxLength(50);
        b.Property(x => x.PaymentToken).HasMaxLength(64);

        // Derived, never stored — see the entity.
        b.Ignore(x => x.Nights);
        b.Ignore(x => x.GuestCount);

        // The SMS link resolves a request by this and nothing else, so it must be unique and
        // indexed. Filtered, because every unpriced request has NULL here.
        b.HasIndex(x => x.PaymentToken)
            .IsUnique()
            .HasFilter("[PaymentToken] IS NOT NULL");

        // The admin list filters by status and orders by check-in.
        b.HasIndex(x => new { x.Status, x.CheckInDate });

        b.HasOne(x => x.Guesthouse)
            .WithMany(g => g.Requests)
            .HasForeignKey(x => x.GuesthouseId)
            .OnDelete(DeleteBehavior.Restrict);

        b.HasMany(x => x.Companions)
            .WithOne(c => c.Request!)
            .HasForeignKey(c => c.RequestId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public class GuesthouseCompanionConfiguration : IEntityTypeConfiguration<GuesthouseCompanion>
{
    public void Configure(EntityTypeBuilder<GuesthouseCompanion> b)
    {
        // No DbSet, so without this EF names the table after the bare class and breaks
        // the plural convention every sibling table follows.
        b.ToTable("GuesthouseCompanions");
        b.Property(x => x.FullName).HasMaxLength(200).IsRequired();
    }
}
```

- [ ] **Step 8: Register the DbSets**

In `src/Infrastructure/Data/ApplicationDbContext.cs`, beside the existing welfare sets:

```csharp
    public DbSet<WelfareGuesthouse> WelfareGuesthouses => Set<WelfareGuesthouse>();

    public DbSet<GuesthouseRequest> GuesthouseRequests => Set<GuesthouseRequest>();
```

In `src/Application/Common/Interfaces/IApplicationDbContext.cs`, beside `WelfarePoolReservations`:

```csharp
    DbSet<WelfareGuesthouse> WelfareGuesthouses { get; }

    DbSet<GuesthouseRequest> GuesthouseRequests { get; }
```

- [ ] **Step 9: Generate the migration**

```bash
dotnet ef migrations add AddWalfareGuesthouse --project src/Infrastructure --startup-project src/Web
```

Expected: a new pair of files under `src/Infrastructure/Data/Migrations/`. Open the `.cs` and confirm it creates `WelfareGuesthouses`, `GuesthouseRequests` and `GuesthouseCompanions`, and the filtered unique index on `PaymentToken`. **If the migration comes out empty, the DbSets were not registered** — go back to step 8.

- [ ] **Step 10: Build and commit**

```bash
dotnet build src/Web/Web.csproj
git add src/Domain/Walfare src/Infrastructure/Data src/Application/Common/Interfaces/IApplicationDbContext.cs tests/Domain.UnitTests/Walfare
git commit -m "feat(walfare): guesthouse domain, EF configuration and migration"
```

---

### Task 2: A neutral SMS sender the whole API can use

**Files:**
- Create: `src/Application/Common/Interfaces/ISmsSender.cs`
- Modify: `src/Infrastructure/Elections/ElectionSmsSender.cs` (class declaration only)
- Modify: `src/Infrastructure/DependencyInjection.cs:208`

**Interfaces:**
- Consumes: nothing.
- Produces: `ISmsSender.SendAsync(string phone, string message, CancellationToken ct) → Task<bool>`.

**Why this shape:** `ElectionSmsSender` is already `SendAsync(phone, message, ct)` and is already bound to the **same `Sms` configuration section as the identity provider**, so production credentials exist and no new secret or deploy step is needed. It only needed a neutral name. Election code is not touched.

- [ ] **Step 1: Create the neutral interface**

Create `src/Application/Common/Interfaces/ISmsSender.cs`:

```csharp
namespace Mabhas19.Application.Common.Interfaces;

/// <summary>
/// Sends one SMS. Returns whether the provider ACCEPTED it — not whether it arrived.
/// </summary>
/// <remarks>
/// Deliberately a bool rather than void: a channel that fails silently is how somebody is told
/// "link sent" about a message that was never sent. Callers must surface false.
/// </remarks>
public interface ISmsSender
{
    Task<bool> SendAsync(string phone, string message, CancellationToken cancellationToken);
}
```

- [ ] **Step 2: Have the existing sender implement it**

In `src/Infrastructure/Elections/ElectionSmsSender.cs`, change the class declaration only. `IElectionSmsSender` stays exactly as it is, so no election code changes:

```csharp
public class ElectionSmsSender(
    HttpClient http,
    IOptions<ElectionSmsOptions> options,
    ILogger<ElectionSmsSender> logger) : IElectionSmsSender, Mabhas19.Application.Common.Interfaces.ISmsSender
```

- [ ] **Step 3: Register one implementation under both names**

In `src/Infrastructure/DependencyInjection.cs`, directly after the existing `AddHttpClient<IElectionSmsSender, ElectionSmsSender>()` at line 208:

```csharp
        // One implementation, two names. The election module keeps its own interface; everything
        // else asks for ISmsSender. Resolving through the typed client reuses that single
        // HttpClient and its policies rather than constructing a second one.
        services.AddScoped<Mabhas19.Application.Common.Interfaces.ISmsSender>(
            sp => (ElectionSmsSender)sp.GetRequiredService<IElectionSmsSender>());
```

- [ ] **Step 4: Build, and confirm nothing in elections broke**

```bash
dotnet build src/Web/Web.csproj
dotnet test tests/Application.UnitTests/Application.UnitTests.csproj
```

Expected: build succeeds; the existing suite passes unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/Application/Common/Interfaces/ISmsSender.cs src/Infrastructure/Elections/ElectionSmsSender.cs src/Infrastructure/DependencyInjection.cs
git commit -m "feat(api): a neutral ISmsSender, reusing the election sender and its config"
```

---

### Task 3: Guesthouse CRUD for the admin

**Files:**
- Create: `src/Application/Walfare/Guesthouses/Guesthouses.cs`
- Modify: `src/Web/Endpoints/Walfare/Walfare.cs` (append a group, add a using)

**Interfaces:**
- Consumes: `WelfareGuesthouse`, `IApplicationDbContext.WelfareGuesthouses` (Task 1).
- Produces: `GuesthouseDto`, `GuesthouseInput`, `GetActiveGuesthousesQuery(int ServiceId)`, `GetGuesthousesAdminQuery`, `CreateGuesthouseCommand(GuesthouseInput)`, `UpdateGuesthouseCommand(int, GuesthouseInput)`, `DeleteGuesthouseCommand(int)`.

- [ ] **Step 1: Write the module**

Create `src/Application/Walfare/Guesthouses/Guesthouses.cs`:

```csharp
using Ardalis.GuardClauses;
using FluentValidation;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Walfare;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Application.Walfare.Guesthouses;

public sealed record GuesthouseDto
{
    public int Id { get; init; }
    public int ServiceId { get; init; }
    public string Name { get; init; } = string.Empty;
    public string City { get; init; } = string.Empty;
    public string ManagerName { get; init; } = string.Empty;
    public string Description { get; init; } = string.Empty;
    public bool IsActive { get; init; }
}

public sealed record GuesthouseInput(
    int ServiceId,
    string Name,
    string City,
    string ManagerName,
    string Description,
    bool IsActive);

public class GuesthouseInputValidator : AbstractValidator<GuesthouseInput>
{
    public GuesthouseInputValidator()
    {
        RuleFor(x => x.Name).NotEmpty().WithMessage("نام مهمانسرا الزامی است.").MaximumLength(200);
        RuleFor(x => x.City).NotEmpty().WithMessage("شهرستان الزامی است.").MaximumLength(100);
        RuleFor(x => x.ManagerName).MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(1000);
    }
}

/// <summary>Shared projection so the member list and the admin list cannot drift apart.</summary>
internal static class GuesthouseDtoProjection
{
    public static GuesthouseDto From(WelfareGuesthouse g) => new()
    {
        Id = g.Id,
        ServiceId = g.ServiceId,
        Name = g.Name,
        City = g.City,
        ManagerName = g.ManagerName,
        Description = g.Description,
        IsActive = g.IsActive
    };
}

// ── member: the guesthouses they may ask for ────────────────────────────────

[Authorize]
public record GetActiveGuesthousesQuery(int ServiceId) : IRequest<IReadOnlyList<GuesthouseDto>>;

public class GetActiveGuesthousesQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetActiveGuesthousesQuery, IReadOnlyList<GuesthouseDto>>
{
    public async Task<IReadOnlyList<GuesthouseDto>> Handle(
        GetActiveGuesthousesQuery request, CancellationToken cancellationToken)
    {
        var rows = await context.WelfareGuesthouses
            .AsNoTracking()
            .Where(g => g.ServiceId == request.ServiceId && g.IsActive)
            .OrderBy(g => g.City).ThenBy(g => g.Name)
            .ToListAsync(cancellationToken);

        return rows.Select(GuesthouseDtoProjection.From).ToList();
    }
}

// ── admin CRUD ──────────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record GetGuesthousesAdminQuery : IRequest<IReadOnlyList<GuesthouseDto>>;

public class GetGuesthousesAdminQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetGuesthousesAdminQuery, IReadOnlyList<GuesthouseDto>>
{
    public async Task<IReadOnlyList<GuesthouseDto>> Handle(
        GetGuesthousesAdminQuery request, CancellationToken cancellationToken)
    {
        var rows = await context.WelfareGuesthouses
            .AsNoTracking()
            .OrderBy(g => g.City).ThenBy(g => g.Name)
            .ToListAsync(cancellationToken);

        return rows.Select(GuesthouseDtoProjection.From).ToList();
    }
}

[Authorize(Roles = Roles.AdminOrSuper)]
public record CreateGuesthouseCommand(GuesthouseInput Input) : IRequest<int>;

public class CreateGuesthouseCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateGuesthouseCommand, int>
{
    public async Task<int> Handle(CreateGuesthouseCommand request, CancellationToken cancellationToken)
    {
        var entity = new WelfareGuesthouse
        {
            ServiceId = request.Input.ServiceId,
            Name = request.Input.Name.Trim(),
            City = request.Input.City.Trim(),
            ManagerName = request.Input.ManagerName.Trim(),
            Description = request.Input.Description.Trim(),
            IsActive = request.Input.IsActive
        };

        context.WelfareGuesthouses.Add(entity);
        await context.SaveChangesAsync(cancellationToken);
        return entity.Id;
    }
}

[Authorize(Roles = Roles.AdminOrSuper)]
public record UpdateGuesthouseCommand(int Id, GuesthouseInput Input) : IRequest;

public class UpdateGuesthouseCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateGuesthouseCommand>
{
    public async Task Handle(UpdateGuesthouseCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.WelfareGuesthouses
            .FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        entity.ServiceId = request.Input.ServiceId;
        entity.Name = request.Input.Name.Trim();
        entity.City = request.Input.City.Trim();
        entity.ManagerName = request.Input.ManagerName.Trim();
        entity.Description = request.Input.Description.Trim();
        entity.IsActive = request.Input.IsActive;

        await context.SaveChangesAsync(cancellationToken);
    }
}

[Authorize(Roles = Roles.AdminOrSuper)]
public record DeleteGuesthouseCommand(int Id) : IRequest;

public class DeleteGuesthouseCommandHandler(IApplicationDbContext context)
    : IRequestHandler<DeleteGuesthouseCommand>
{
    public async Task Handle(DeleteGuesthouseCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.WelfareGuesthouses
            .Include(g => g.Requests)
            .FirstOrDefaultAsync(g => g.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        // A guesthouse with history is deactivated, never deleted: the FK is Restrict, and a paid
        // referral must keep pointing at the place it was issued for.
        if (entity.Requests.Count > 0)
        {
            entity.IsActive = false;
        }
        else
        {
            context.WelfareGuesthouses.Remove(entity);
        }

        await context.SaveChangesAsync(cancellationToken);
    }
}
```

- [ ] **Step 2: Register the endpoints**

Add `using Mabhas19.Application.Walfare.Guesthouses;` to the top of `src/Web/Endpoints/Walfare/Walfare.cs`, then append:

```csharp
/// <summary>Guesthouses (مهمانسراها): active list for members, CRUD for admins.</summary>
public class WalfareGuesthouses : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/walfare/guesthouses";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetWalfareActiveGuesthouses, string.Empty).RequireAuthorization();
        groupBuilder.MapGet(GetWalfareGuesthousesAdmin, "admin").RequireAdmin();
        groupBuilder.MapPost(CreateWalfareGuesthouse, string.Empty).RequireAdmin();
        groupBuilder.MapPut(UpdateWalfareGuesthouse, "{id:int}").RequireAdmin();
        groupBuilder.MapDelete(DeleteWalfareGuesthouse, "{id:int}").RequireAdmin();
    }

    public static async Task<Ok<IReadOnlyList<GuesthouseDto>>> GetWalfareActiveGuesthouses(
        ISender sender, int serviceId)
        => TypedResults.Ok(await sender.Send(new GetActiveGuesthousesQuery(serviceId)));

    public static async Task<Ok<IReadOnlyList<GuesthouseDto>>> GetWalfareGuesthousesAdmin(ISender sender)
        => TypedResults.Ok(await sender.Send(new GetGuesthousesAdminQuery()));

    public static async Task<Created<int>> CreateWalfareGuesthouse(ISender sender, GuesthouseInput body)
    {
        var id = await sender.Send(new CreateGuesthouseCommand(body));
        return TypedResults.Created($"/api/walfare/guesthouses/{id}", id);
    }

    public static async Task<NoContent> UpdateWalfareGuesthouse(ISender sender, int id, GuesthouseInput body)
    {
        await sender.Send(new UpdateGuesthouseCommand(id, body));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> DeleteWalfareGuesthouse(ISender sender, int id)
    {
        await sender.Send(new DeleteGuesthouseCommand(id));
        return TypedResults.NoContent();
    }
}
```

- [ ] **Step 3: Build**

```bash
dotnet build src/Web/Web.csproj
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/Application/Walfare/Guesthouses src/Web/Endpoints/Walfare/Walfare.cs
git commit -m "feat(walfare): guesthouse CRUD for admins, active list for members"
```

---

### Task 4: Submitting a request — member and admin

**Files:**
- Create: `src/Application/Walfare/Guesthouses/GuesthouseRequests.cs`
- Modify: `src/Web/Endpoints/Walfare/Walfare.cs`
- Test: `tests/Application.UnitTests/Walfare/GuesthouseRequestValidatorTests.cs`

**Interfaces:**
- Consumes: `GuesthouseRequest`, `GuesthouseCompanion`, `CompanionRelation`, `ApplicantGender` (Task 1); `JalaliDate.Parse`.
- Produces: `CompanionRelationInput`, `CompanionInput`, `GuesthouseRequestInput`, `GuesthouseRequestInputValidator.Digits(string?)`, `CompanionDto`, `GuesthouseRequestDto`, `GuesthouseProjection.ToDto(GuesthouseRequest)`, `GuesthouseRequestFactory.Build(...)`, `CreateGuesthouseRequestCommand`, `CreateGuesthouseRequestAdminCommand`, `GetMyGuesthouseRequestsQuery`.

**The rule that matters:** the admin path must work for a national code the membership database has never heard of. The lookup is a convenience beside the field, never a gate.

- [ ] **Step 1: Write the failing validator test**

Create `tests/Application.UnitTests/Walfare/GuesthouseRequestValidatorTests.cs`:

```csharp
using Shouldly;
using Mabhas19.Application.Walfare.Guesthouses;
using NUnit.Framework;

namespace Mabhas19.Application.UnitTests.Walfare;

public class GuesthouseRequestValidatorTests
{
    private static GuesthouseRequestInput Valid(params CompanionInput[] companions) => new(
        GuesthouseId: 1,
        FullName: "نام نمونه",
        NationalCode: "1234567890",
        MembershipNumber: "12345",
        Mobile: "09180000000",
        CheckInDate: "1405/05/27",
        CheckOutDate: "1405/05/29",
        Companions: companions);

    private readonly GuesthouseRequestInputValidator _validator = new();

    [Test]
    public void Accepts_a_well_formed_request()
        => _validator.Validate(Valid()).IsValid.ShouldBeTrue();

    [Test]
    public void Refuses_a_checkout_before_the_checkin()
    {
        var input = Valid() with { CheckInDate = "1405/05/29", CheckOutDate = "1405/05/27" };

        _validator.Validate(input).IsValid.ShouldBeFalse();
    }

    [Test]
    public void Refuses_a_stay_of_zero_nights()
        => _validator.Validate(Valid() with { CheckOutDate = "1405/05/27" }).IsValid.ShouldBeFalse();

    [Test]
    public void Refuses_more_than_five_companions()
    {
        var six = Enumerable.Range(0, 6)
            .Select(i => new CompanionInput($"همراه {i}", CompanionRelationInput.Child, false))
            .ToArray();

        _validator.Validate(Valid(six)).IsValid.ShouldBeFalse();
    }

    [Test]
    public void Refuses_more_than_two_infants()
    {
        var three = Enumerable.Range(0, 3)
            .Select(i => new CompanionInput($"کودک {i}", null, true))
            .ToArray();

        _validator.Validate(Valid(three)).IsValid.ShouldBeFalse();
    }

    [Test]
    public void Accepts_five_companions_and_two_infants_together()
    {
        var people = Enumerable.Range(0, 5)
            .Select(i => new CompanionInput($"همراه {i}", CompanionRelationInput.Child, false))
            .Concat(Enumerable.Range(0, 2).Select(i => new CompanionInput($"کودک {i}", null, true)))
            .ToArray();

        _validator.Validate(Valid(people)).IsValid.ShouldBeTrue();
    }

    [Test]
    public void Refuses_a_national_code_that_is_not_ten_digits()
        => _validator.Validate(Valid() with { NationalCode = "12345" }).IsValid.ShouldBeFalse();

    [Test]
    public void Refuses_an_unparseable_jalali_date()
        => _validator.Validate(Valid() with { CheckInDate = "1405/13/40" }).IsValid.ShouldBeFalse();

    /// <summary>
    /// The bug that locked an engineer out of the welfare service: a code pasted from a message
    /// carries an invisible direction mark, which is not whitespace, so Trim() leaves it and a
    /// length check refuses a perfectly good code. Admins will paste into this form.
    /// </summary>
    [Test]
    public void Accepts_a_national_code_pasted_with_an_invisible_mark()
        => _validator.Validate(Valid() with { NationalCode = "1234567890‏" }).IsValid.ShouldBeTrue();

    [Test]
    public void Accepts_persian_digits_in_the_national_code()
        => _validator.Validate(Valid() with { NationalCode = "۱۲۳۴۵۶۷۸۹۰" }).IsValid.ShouldBeTrue();
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
dotnet test tests/Application.UnitTests/Application.UnitTests.csproj --filter GuesthouseRequestValidatorTests
```

Expected: FAIL — `GuesthouseRequestInput` does not exist.

- [ ] **Step 3: Write the inputs and the validator**

Create `src/Application/Walfare/Guesthouses/GuesthouseRequests.cs`:

```csharp
using Ardalis.GuardClauses;
using FluentValidation;
using Mabhas19.Application.Common;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Walfare;
using Microsoft.EntityFrameworkCore;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Walfare.Guesthouses;

file static class Fail
{
    public static ValidationException With(string property, string message) =>
        new([new FluentValidation.Results.ValidationFailure(property, message)]);
}

/// <summary>Mirrors <see cref="CompanionRelation"/> on the wire. Numbers, not strings.</summary>
public enum CompanionRelationInput
{
    Spouse = 0,
    Child = 1,
    Father = 2,
    Mother = 3,
    Brother = 4,
    Sister = 5,
    Other = 6
}

public sealed record CompanionInput(string FullName, CompanionRelationInput? Relation, bool IsInfant);

public sealed record GuesthouseRequestInput(
    int GuesthouseId,
    string FullName,
    string NationalCode,
    string MembershipNumber,
    string Mobile,
    string CheckInDate,
    string CheckOutDate,
    CompanionInput[] Companions);

public class GuesthouseRequestInputValidator : AbstractValidator<GuesthouseRequestInput>
{
    public GuesthouseRequestInputValidator()
    {
        RuleFor(x => x.FullName).NotEmpty().WithMessage("نام و نام خانوادگی الزامی است.").MaximumLength(200);

        RuleFor(x => x.NationalCode)
            .Must(c => Digits(c).Length == 10)
            .WithMessage("کد ملی باید ۱۰ رقم باشد.");

        RuleFor(x => x.Mobile)
            .Must(m => Digits(m).Length == 11)
            .WithMessage("شماره همراه باید ۱۱ رقم باشد.");

        RuleFor(x => x.CheckInDate)
            .Must(d => JalaliDate.Parse(d) is not null)
            .WithMessage("تاریخ ورود معتبر نیست.");

        RuleFor(x => x.CheckOutDate)
            .Must(d => JalaliDate.Parse(d) is not null)
            .WithMessage("تاریخ خروج معتبر نیست.");

        RuleFor(x => x.CheckOutDate)
            .Must((input, _) =>
            {
                var inDate = JalaliDate.Parse(input.CheckInDate);
                var outDate = JalaliDate.Parse(input.CheckOutDate);
                return inDate is null || outDate is null || outDate > inDate;
            })
            .WithMessage("تاریخ خروج باید بعد از تاریخ ورود باشد.");

        RuleFor(x => x.Companions)
            .Must(c => c.Count(p => !p.IsInfant) <= 5)
            .WithMessage("حداکثر ۵ همراه می‌توانید ثبت کنید.");

        RuleFor(x => x.Companions)
            .Must(c => c.Count(p => p.IsInfant) <= 2)
            .WithMessage("حداکثر ۲ کودک زیر دو سال می‌توانید ثبت کنید.");

        RuleForEach(x => x.Companions).ChildRules(c =>
            c.RuleFor(p => p.FullName).NotEmpty().WithMessage("نام همراه الزامی است.").MaximumLength(200));
    }

    /// <summary>
    /// Keeps ONLY digits, after folding Persian and Arabic-Indic ones to ASCII.
    /// </summary>
    /// <remarks>
    /// Not <c>Trim()</c>. A national code pasted out of a message carries an invisible direction
    /// mark that is not whitespace, so the value arrives one character longer than it looks and a
    /// length check refuses a perfectly good code. That exact bug locked an engineer out of this
    /// very service — see docs/ai/GOTCHAS.md.
    /// </remarks>
    internal static string Digits(string? value)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;

        var sb = new System.Text.StringBuilder(value.Length);
        foreach (var ch in value)
        {
            if (ch is >= '0' and <= '9') sb.Append(ch);
            else if (ch is >= '۰' and <= '۹') sb.Append((char)('0' + (ch - '۰')));
            else if (ch is >= '٠' and <= '٩') sb.Append((char)('0' + (ch - '٠')));
        }
        return sb.ToString();
    }
}

/// <summary>
/// Bridges the input validator onto the command.
/// </summary>
/// <remarks>
/// Without this the rules above are DEAD CODE. `ValidationBehaviour` resolves
/// `IValidator&lt;TRequest&gt;` where TRequest is the command, so an `AbstractValidator&lt;SomeInput&gt;`
/// is never found and never runs — while unit tests that construct it directly still pass.
/// `WelfarePools.cs` bridges the same way.
/// </remarks>
public class CreateGuesthouseRequestCommandValidator : AbstractValidator<CreateGuesthouseRequestCommand>
{
    public CreateGuesthouseRequestCommandValidator()
        => RuleFor(x => x.Input).SetValidator(new GuesthouseRequestInputValidator());
}

public class CreateGuesthouseRequestAdminCommandValidator
    : AbstractValidator<CreateGuesthouseRequestAdminCommand>
{
    public CreateGuesthouseRequestAdminCommandValidator()
        => RuleFor(x => x.Input).SetValidator(new GuesthouseRequestInputValidator());
}
```

**Note:** the two command validators above reference `CreateGuesthouseRequestCommand` and
`CreateGuesthouseRequestAdminCommand`, which step 5 declares. Add them in step 5, after those
records exist, rather than in step 3 — the file will not compile until both halves are present.

- [ ] **Step 4: Run the validator tests and watch them pass**

```bash
dotnet test tests/Application.UnitTests/Application.UnitTests.csproj --filter GuesthouseRequestValidatorTests
```

Expected: PASS, 10 tests.

- [ ] **Step 5: Add the DTO, the factory and the three handlers**

Append to `src/Application/Walfare/Guesthouses/GuesthouseRequests.cs`:

```csharp
public sealed record CompanionDto(string FullName, CompanionRelationInput? Relation, bool IsInfant);

public sealed record GuesthouseRequestDto
{
    public int Id { get; init; }
    public int GuesthouseId { get; init; }
    public string GuesthouseName { get; init; } = string.Empty;
    public string GuesthouseCity { get; init; } = string.Empty;
    public string FullName { get; init; } = string.Empty;
    public string NationalCode { get; init; } = string.Empty;
    public string MembershipNumber { get; init; } = string.Empty;
    public string Mobile { get; init; } = string.Empty;
    public ApplicantGender? Gender { get; init; }
    public string CheckInDateJalali { get; init; } = string.Empty;
    public string CheckOutDateJalali { get; init; } = string.Empty;
    public int Nights { get; init; }
    public int GuestCount { get; init; }
    public long AmountRials { get; init; }
    public string AdminNote { get; init; } = string.Empty;
    public GuesthouseRequestStatus Status { get; init; }
    public string ReceiptNumber { get; init; } = string.Empty;
    public bool CreatedByAdmin { get; init; }

    /// <summary>
    /// Only ever sent to the row's OWNER or to an admin — it is what their own pay button opens.
    /// Never on the anonymous payment payload.
    /// </summary>
    public string? PaymentToken { get; init; }

    public DateTimeOffset? PaidAtUtc { get; init; }
    public CompanionDto[] Companions { get; init; } = [];
}

/// <summary>Shared projection so the member list and the admin list cannot drift apart.</summary>
internal static class GuesthouseProjection
{
    public static GuesthouseRequestDto ToDto(GuesthouseRequest r) => new()
    {
        Id = r.Id,
        GuesthouseId = r.GuesthouseId,
        GuesthouseName = r.Guesthouse?.Name ?? string.Empty,
        GuesthouseCity = r.Guesthouse?.City ?? string.Empty,
        FullName = r.FullName,
        NationalCode = r.NationalCode,
        MembershipNumber = r.MembershipNumber,
        Mobile = r.Mobile,
        Gender = r.Gender,
        CheckInDateJalali = r.CheckInDateJalali,
        CheckOutDateJalali = r.CheckOutDateJalali,
        Nights = r.Nights,
        GuestCount = r.GuestCount,
        AmountRials = r.AmountRials,
        AdminNote = r.AdminNote,
        Status = r.Status,
        ReceiptNumber = r.ReceiptNumber,
        CreatedByAdmin = r.CreatedByAdmin,
        PaymentToken = r.PaymentToken,
        PaidAtUtc = r.PaidAtUtc,
        Companions = r.Companions
            .Select(c => new CompanionDto(
                c.FullName,
                c.Relation is null ? null : (CompanionRelationInput)(int)c.Relation,
                c.IsInfant))
            .ToArray()
    };
}

internal static class GuesthouseRequestFactory
{
    public static GuesthouseRequest Build(GuesthouseRequestInput input, string? userId, bool byAdmin)
    {
        var checkIn = JalaliDate.Parse(input.CheckInDate)
            ?? throw Fail.With(nameof(input.CheckInDate), "تاریخ ورود معتبر نیست.");
        var checkOut = JalaliDate.Parse(input.CheckOutDate)
            ?? throw Fail.With(nameof(input.CheckOutDate), "تاریخ خروج معتبر نیست.");

        var entity = new GuesthouseRequest
        {
            GuesthouseId = input.GuesthouseId,
            UserId = userId,
            CreatedByAdmin = byAdmin,
            Status = GuesthouseRequestStatus.Submitted,
            FullName = input.FullName.Trim(),
            NationalCode = GuesthouseRequestInputValidator.Digits(input.NationalCode),
            MembershipNumber = GuesthouseRequestInputValidator.Digits(input.MembershipNumber),
            Mobile = GuesthouseRequestInputValidator.Digits(input.Mobile),
            CheckInDateJalali = input.CheckInDate.Trim(),
            CheckOutDateJalali = input.CheckOutDate.Trim(),
            CheckInDate = checkIn.Value,
            CheckOutDate = checkOut.Value
        };

        foreach (var c in input.Companions)
        {
            entity.Companions.Add(new GuesthouseCompanion
            {
                FullName = c.FullName.Trim(),
                // An infant has no نسبت column on the paper form, so none is stored for one.
                Relation = c.IsInfant || c.Relation is null ? null : (CompanionRelation)(int)c.Relation,
                IsInfant = c.IsInfant
            });
        }

        return entity;
    }
}

// ── member submits ──────────────────────────────────────────────────────────

[Authorize]
public record CreateGuesthouseRequestCommand(GuesthouseRequestInput Input) : IRequest<int>;

public class CreateGuesthouseRequestCommandHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<CreateGuesthouseRequestCommand, int>
{
    public async Task<int> Handle(CreateGuesthouseRequestCommand request, CancellationToken cancellationToken)
    {
        var guesthouse = await context.WelfareGuesthouses
            .Include(g => g.Service)
            .FirstOrDefaultAsync(g => g.Id == request.Input.GuesthouseId, cancellationToken);
        Guard.Against.NotFound(request.Input.GuesthouseId, guesthouse);

        if (!guesthouse.IsActive || guesthouse.Service?.IsAccessible != true)
            throw Fail.With(nameof(request.Input.GuesthouseId), "این مهمانسرا در حال حاضر فعال نیست.");

        var entity = GuesthouseRequestFactory.Build(
            request.Input,
            user.Id ?? throw Fail.With("UserId", "حساب کاربری نامعتبر است."),
            byAdmin: false);

        context.GuesthouseRequests.Add(entity);
        await context.SaveChangesAsync(cancellationToken);
        return entity.Id;
    }
}

// ── admin submits on somebody's behalf ──────────────────────────────────────

/// <summary>
/// The admin's own intake, for a person the membership database has never heard of.
/// </summary>
/// <remarks>
/// Takes every field verbatim and looks nothing up. The national-code lookup is a convenience on the
/// FORM, not a gate here: a request for somebody with no record must save exactly as easily as one
/// for a member. UserId stays null, so the row can never appear in anybody's "my requests" list —
/// the SMS link is that person's only door.
/// </remarks>
[Authorize(Roles = Roles.AdminOrSuper)]
public record CreateGuesthouseRequestAdminCommand(GuesthouseRequestInput Input) : IRequest<int>;

public class CreateGuesthouseRequestAdminCommandHandler(IApplicationDbContext context)
    : IRequestHandler<CreateGuesthouseRequestAdminCommand, int>
{
    public async Task<int> Handle(
        CreateGuesthouseRequestAdminCommand request, CancellationToken cancellationToken)
    {
        var guesthouse = await context.WelfareGuesthouses
            .FirstOrDefaultAsync(g => g.Id == request.Input.GuesthouseId, cancellationToken);
        Guard.Against.NotFound(request.Input.GuesthouseId, guesthouse);

        var entity = GuesthouseRequestFactory.Build(request.Input, userId: null, byAdmin: true);

        context.GuesthouseRequests.Add(entity);
        await context.SaveChangesAsync(cancellationToken);
        return entity.Id;
    }
}

// ── member: my requests ─────────────────────────────────────────────────────

[Authorize]
public record GetMyGuesthouseRequestsQuery : IRequest<IReadOnlyList<GuesthouseRequestDto>>;

public class GetMyGuesthouseRequestsQueryHandler(IApplicationDbContext context, IUser user)
    : IRequestHandler<GetMyGuesthouseRequestsQuery, IReadOnlyList<GuesthouseRequestDto>>
{
    public async Task<IReadOnlyList<GuesthouseRequestDto>> Handle(
        GetMyGuesthouseRequestsQuery request, CancellationToken cancellationToken)
    {
        var userId = user.Id ?? string.Empty;

        var rows = await context.GuesthouseRequests
            .AsNoTracking()
            .Include(r => r.Guesthouse)
            .Include(r => r.Companions)
            .Where(r => r.UserId == userId)
            .OrderByDescending(r => r.CheckInDate)
            .ToListAsync(cancellationToken);

        return rows.Select(GuesthouseProjection.ToDto).ToList();
    }
}
```

- [ ] **Step 6: Register the endpoints**

Append to `src/Web/Endpoints/Walfare/Walfare.cs`:

```csharp
/// <summary>Guesthouse requests (درخواست مهمانسرا).</summary>
public class WalfareGuesthouseRequests : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/walfare/guesthouse-requests";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapPost(CreateWalfareGuesthouseRequest, string.Empty).RequireAuthorization();
        groupBuilder.MapGet(GetWalfareMyGuesthouseRequests, "mine").RequireAuthorization();
        groupBuilder.MapPost(CreateWalfareGuesthouseRequestAdmin, "admin").RequireAdmin();
    }

    public static async Task<Created<int>> CreateWalfareGuesthouseRequest(
        ISender sender, GuesthouseRequestInput body)
    {
        var id = await sender.Send(new CreateGuesthouseRequestCommand(body));
        return TypedResults.Created($"/api/walfare/guesthouse-requests/{id}", id);
    }

    public static async Task<Ok<IReadOnlyList<GuesthouseRequestDto>>> GetWalfareMyGuesthouseRequests(
        ISender sender)
        => TypedResults.Ok(await sender.Send(new GetMyGuesthouseRequestsQuery()));

    public static async Task<Created<int>> CreateWalfareGuesthouseRequestAdmin(
        ISender sender, GuesthouseRequestInput body)
    {
        var id = await sender.Send(new CreateGuesthouseRequestAdminCommand(body));
        return TypedResults.Created($"/api/walfare/guesthouse-requests/{id}", id);
    }
}
```

- [ ] **Step 7: Build, test and commit**

```bash
dotnet build src/Web/Web.csproj
dotnet test tests/Application.UnitTests/Application.UnitTests.csproj
git add src/Application/Walfare/Guesthouses src/Web/Endpoints/Walfare/Walfare.cs tests/Application.UnitTests/Walfare
git commit -m "feat(walfare): submit a guesthouse request, as a member or on their behalf"
```

---

### Task 5: Pricing, rejecting, and the admin list

**Files:**
- Create: `src/Application/Walfare/Guesthouses/GuesthouseAdmin.cs`
- Modify: `src/Web/Endpoints/Walfare/Walfare.cs`
- Test: `tests/Application.UnitTests/Walfare/GuesthouseTransitionTests.cs`

**Interfaces:**
- Consumes: `GuesthouseRequest`, `GuesthouseRequestStatus`, `ApplicantGender` (Task 1); `GuesthouseRequestDto`, `GuesthouseProjection.ToDto` (Task 4).
- Produces: `GuesthouseTransitions.CanPrice/CanReject/CanCancel/CanPay`, `GuesthouseTokens.Mint()`, `GuesthouseTokens.Lifetime`, `PriceGuesthouseRequestCommand(int, long, string, ApplicantGender?)`, `RejectGuesthouseRequestCommand(int, string)`, `GetGuesthouseRequestsAdminQuery(GuesthouseRequestStatus?, int?)`.

- [ ] **Step 1: Write the failing transition test**

Create `tests/Application.UnitTests/Walfare/GuesthouseTransitionTests.cs`:

```csharp
using Shouldly;
using Mabhas19.Application.Walfare.Guesthouses;
using Mabhas19.Domain.Walfare;
using NUnit.Framework;

namespace Mabhas19.Application.UnitTests.Walfare;

public class GuesthouseTransitionTests
{
    [TestCase(GuesthouseRequestStatus.Submitted, true)]
    [TestCase(GuesthouseRequestStatus.Priced, true)]   // re-pricing before payment is allowed
    [TestCase(GuesthouseRequestStatus.Paid, false)]
    [TestCase(GuesthouseRequestStatus.Rejected, false)]
    [TestCase(GuesthouseRequestStatus.Cancelled, false)]
    public void CanPrice_only_before_money_has_moved(GuesthouseRequestStatus status, bool expected)
        => GuesthouseTransitions.CanPrice(status).ShouldBe(expected);

    [TestCase(GuesthouseRequestStatus.Submitted, true)]
    [TestCase(GuesthouseRequestStatus.Priced, true)]
    [TestCase(GuesthouseRequestStatus.Paid, false)]
    [TestCase(GuesthouseRequestStatus.Rejected, false)]
    public void CanReject_never_after_payment(GuesthouseRequestStatus status, bool expected)
        => GuesthouseTransitions.CanReject(status).ShouldBe(expected);

    [TestCase(GuesthouseRequestStatus.Priced, true)]
    [TestCase(GuesthouseRequestStatus.Submitted, false)]   // nothing to pay yet
    [TestCase(GuesthouseRequestStatus.Paid, false)]        // already paid
    [TestCase(GuesthouseRequestStatus.Cancelled, false)]
    public void CanPay_only_from_priced(GuesthouseRequestStatus status, bool expected)
        => GuesthouseTransitions.CanPay(status).ShouldBe(expected);

    [Test]
    public void Mint_produces_a_url_safe_token_of_a_useful_length()
    {
        var token = GuesthouseTokens.Mint();

        token.Length.ShouldBe(43);                       // 32 bytes, base64url, unpadded
        token.ShouldMatch("^[A-Za-z0-9_-]+$");
    }

    [Test]
    public void Mint_does_not_repeat_itself()
    {
        var tokens = Enumerable.Range(0, 200).Select(_ => GuesthouseTokens.Mint()).ToHashSet();

        tokens.Count.ShouldBe(200);
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
dotnet test tests/Application.UnitTests/Application.UnitTests.csproj --filter GuesthouseTransitionTests
```

Expected: FAIL — `GuesthouseTransitions` does not exist.

- [ ] **Step 3: Write the guards, the token minter and the commands**

Create `src/Application/Walfare/Guesthouses/GuesthouseAdmin.cs`:

```csharp
using System.Security.Cryptography;
using Ardalis.GuardClauses;
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Common.Security;
using Mabhas19.Domain.Constants;
using Mabhas19.Domain.Walfare;
using Microsoft.EntityFrameworkCore;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Walfare.Guesthouses;

file static class Fail
{
    public static ValidationException With(string property, string message) =>
        new([new FluentValidation.Results.ValidationFailure(property, message)]);
}

/// <summary>
/// The only place that says which moves are legal. Handlers ask; they never re-derive.
/// </summary>
public static class GuesthouseTransitions
{
    /// <summary>Re-pricing a priced request is allowed — the amount is correctable until it is paid.</summary>
    public static bool CanPrice(GuesthouseRequestStatus s) =>
        s is GuesthouseRequestStatus.Submitted or GuesthouseRequestStatus.Priced;

    public static bool CanReject(GuesthouseRequestStatus s) =>
        s is GuesthouseRequestStatus.Submitted or GuesthouseRequestStatus.Priced;

    public static bool CanCancel(GuesthouseRequestStatus s) =>
        s is GuesthouseRequestStatus.Submitted or GuesthouseRequestStatus.Priced;

    public static bool CanPay(GuesthouseRequestStatus s) => s is GuesthouseRequestStatus.Priced;
}

public static class GuesthouseTokens
{
    /// <summary>How long a payment link stays open.</summary>
    public static readonly TimeSpan Lifetime = TimeSpan.FromDays(7);

    /// <summary>32 random bytes, base64url, unpadded — safe in an SMS and in a URL.</summary>
    public static string Mint()
    {
        Span<byte> bytes = stackalloc byte[32];
        RandomNumberGenerator.Fill(bytes);
        return Convert.ToBase64String(bytes)
            .Replace('+', '-').Replace('/', '_').TrimEnd('=');
    }
}

// ── admin: confirm and price ────────────────────────────────────────────────

/// <summary>
/// Confirms a request and sets what it costs. This is what makes it payable.
/// </summary>
/// <remarks>
/// The token is minted HERE, not at submission: a token on a request with no amount is a payable
/// link for a price nobody has set. Re-pricing keeps the same token and only extends its life —
/// a second live link for one request is how somebody pays twice.
/// </remarks>
[Authorize(Roles = Roles.AdminOrSuper)]
public record PriceGuesthouseRequestCommand(
    int Id,
    long AmountRials,
    string AdminNote,
    ApplicantGender? Gender) : IRequest;

public class PriceGuesthouseRequestCommandHandler(IApplicationDbContext context, TimeProvider clock)
    : IRequestHandler<PriceGuesthouseRequestCommand>
{
    public async Task Handle(PriceGuesthouseRequestCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.GuesthouseRequests
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        if (!GuesthouseTransitions.CanPrice(entity.Status))
            throw Fail.With(nameof(request.Id), "این درخواست در وضعیتی نیست که بتوان مبلغ آن را تعیین کرد.");

        if (request.AmountRials <= 0)
            throw Fail.With(nameof(request.AmountRials), "مبلغ باید بیشتر از صفر باشد.");

        entity.AmountRials = request.AmountRials;
        entity.AdminNote = request.AdminNote?.Trim() ?? string.Empty;
        if (request.Gender is not null) entity.Gender = request.Gender;

        entity.PaymentToken ??= GuesthouseTokens.Mint();
        entity.PaymentTokenExpiresUtc = clock.GetUtcNow().Add(GuesthouseTokens.Lifetime);
        entity.Status = GuesthouseRequestStatus.Priced;

        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── admin: refuse ───────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record RejectGuesthouseRequestCommand(int Id, string Reason) : IRequest;

public class RejectGuesthouseRequestCommandHandler(IApplicationDbContext context)
    : IRequestHandler<RejectGuesthouseRequestCommand>
{
    public async Task Handle(RejectGuesthouseRequestCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.GuesthouseRequests
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        if (!GuesthouseTransitions.CanReject(entity.Status))
            throw Fail.With(nameof(request.Id), "این درخواست قابل رد کردن نیست.");

        if (string.IsNullOrWhiteSpace(request.Reason))
            throw Fail.With(nameof(request.Reason), "دلیل رد درخواست را بنویسید.");

        entity.Status = GuesthouseRequestStatus.Rejected;
        entity.AdminNote = request.Reason.Trim();

        // A refused request must not keep a live payment link.
        entity.PaymentToken = null;
        entity.PaymentTokenExpiresUtc = null;

        await context.SaveChangesAsync(cancellationToken);
    }
}

// ── admin: the list ─────────────────────────────────────────────────────────

[Authorize(Roles = Roles.AdminOrSuper)]
public record GetGuesthouseRequestsAdminQuery(
    GuesthouseRequestStatus? Status,
    int? GuesthouseId) : IRequest<IReadOnlyList<GuesthouseRequestDto>>;

public class GetGuesthouseRequestsAdminQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetGuesthouseRequestsAdminQuery, IReadOnlyList<GuesthouseRequestDto>>
{
    public async Task<IReadOnlyList<GuesthouseRequestDto>> Handle(
        GetGuesthouseRequestsAdminQuery request, CancellationToken cancellationToken)
    {
        var query = context.GuesthouseRequests
            .AsNoTracking()
            .Include(r => r.Guesthouse)
            .Include(r => r.Companions)
            .AsQueryable();

        if (request.Status is not null) query = query.Where(r => r.Status == request.Status);
        if (request.GuesthouseId is not null) query = query.Where(r => r.GuesthouseId == request.GuesthouseId);

        var rows = await query
            .OrderByDescending(r => r.CheckInDate)
            .Take(500)
            .ToListAsync(cancellationToken);

        return rows.Select(GuesthouseProjection.ToDto).ToList();
    }
}
```

- [ ] **Step 4: Run the transition tests and watch them pass**

```bash
dotnet test tests/Application.UnitTests/Application.UnitTests.csproj --filter GuesthouseTransitionTests
```

Expected: PASS, 15 cases.

- [ ] **Step 5: Register the endpoints**

Add to the `WalfareGuesthouseRequests` group's `Map` in `src/Web/Endpoints/Walfare/Walfare.cs`:

```csharp
        groupBuilder.MapGet(GetWalfareGuesthouseRequestsAdmin, "admin/list").RequireAdmin();
        groupBuilder.MapPost(PriceWalfareGuesthouseRequest, "{id:int}/price").RequireAdmin();
        groupBuilder.MapPost(RejectWalfareGuesthouseRequest, "{id:int}/reject").RequireAdmin();
```

and these members to the same class:

```csharp
    public record PriceGuesthouseBody(long AmountRials, string AdminNote, ApplicantGender? Gender);

    public record RejectGuesthouseBody(string Reason);

    public static async Task<Ok<IReadOnlyList<GuesthouseRequestDto>>> GetWalfareGuesthouseRequestsAdmin(
        ISender sender, GuesthouseRequestStatus? status, int? guesthouseId)
        => TypedResults.Ok(await sender.Send(new GetGuesthouseRequestsAdminQuery(status, guesthouseId)));

    public static async Task<NoContent> PriceWalfareGuesthouseRequest(
        ISender sender, int id, PriceGuesthouseBody body)
    {
        await sender.Send(new PriceGuesthouseRequestCommand(id, body.AmountRials, body.AdminNote, body.Gender));
        return TypedResults.NoContent();
    }

    public static async Task<NoContent> RejectWalfareGuesthouseRequest(
        ISender sender, int id, RejectGuesthouseBody body)
    {
        await sender.Send(new RejectGuesthouseRequestCommand(id, body.Reason));
        return TypedResults.NoContent();
    }
```

- [ ] **Step 6: Build, test and commit**

```bash
dotnet build src/Web/Web.csproj
dotnet test tests/Application.UnitTests/Application.UnitTests.csproj
git add src/Application/Walfare/Guesthouses src/Web/Endpoints/Walfare/Walfare.cs tests/Application.UnitTests/Walfare
git commit -m "feat(walfare): price, reject and list guesthouse requests"
```

---

### Task 6: Paying by token

**Files:**
- Create: `src/Application/Walfare/Guesthouses/GuesthousePayments.cs`
- Modify: `src/Application/Walfare/Payments/Payments.cs` (the `PaymentCompletion` block at lines 18–46, and the usings)
- Modify: `src/Web/Endpoints/Walfare/Walfare.cs`
- Test: `tests/Application.UnitTests/Walfare/GuesthousePaymentSummaryTests.cs`

**Interfaces:**
- Consumes: `GuesthouseTransitions.CanPay` (Task 5); `IPaymentGateway`, `PaymentTransaction`, `PaymentGateway`, `PaymentStatus`, `PaymentRedirectDto` (existing).
- Produces: `GuesthousePaymentSummaryDto`, `GuesthousePaymentRules.Evaluate(status, expiresUtc, now)`, `GetGuesthousePaymentSummaryQuery(string Token)`, `InitGuesthousePaymentCommand(string Token)`, `InitGuesthousePaymentCommandHandler.TargetType = "guesthouse-request"`.

**The privacy rule:** that link is a bearer token sitting in an SMS inbox. The summary carries the stay and the amount and **no identifiers** — same reasoning as room-web's `/j/:joinToken` landing.

- [ ] **Step 1: Write the failing summary test**

Create `tests/Application.UnitTests/Walfare/GuesthousePaymentSummaryTests.cs`:

```csharp
using System.Reflection;
using Shouldly;
using Mabhas19.Application.Walfare.Guesthouses;
using Mabhas19.Domain.Walfare;
using NUnit.Framework;

namespace Mabhas19.Application.UnitTests.Walfare;

public class GuesthousePaymentSummaryTests
{
    /// <summary>
    /// The link goes out by SMS and can be forwarded to anyone. Whoever opens it must learn what
    /// they are paying for and nothing about whom the stay is for. This test is the guard: adding
    /// an identifier to the DTO breaks it on purpose.
    /// </summary>
    [Test]
    public void Summary_carries_no_identifying_field()
    {
        var names = typeof(GuesthousePaymentSummaryDto)
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Select(p => p.Name)
            .ToArray();

        names.ShouldBe(new[]
        {
            "GuesthouseName", "GuesthouseCity", "CheckInDateJalali", "CheckOutDateJalali",
            "Nights", "GuestCount", "AmountRials", "Payable", "Reason"
        }, ignoreOrder: true);
    }

    [Test]
    public void Payable_when_priced_and_unexpired()
    {
        var now = DateTimeOffset.UtcNow;

        GuesthousePaymentRules
            .Evaluate(GuesthouseRequestStatus.Priced, now.AddDays(1), now)
            .Payable.ShouldBeTrue();
    }

    [Test]
    public void An_expired_link_refuses_rather_than_opening_the_gateway()
    {
        var now = DateTimeOffset.UtcNow;

        var result = GuesthousePaymentRules.Evaluate(
            GuesthouseRequestStatus.Priced, now.AddMinutes(-1), now);

        result.Payable.ShouldBeFalse();
        result.Reason.ShouldContain("منقضی");
    }

    [Test]
    public void An_already_paid_link_says_so_instead_of_charging_twice()
    {
        var now = DateTimeOffset.UtcNow;

        var result = GuesthousePaymentRules.Evaluate(
            GuesthouseRequestStatus.Paid, now.AddDays(1), now);

        result.Payable.ShouldBeFalse();
        result.Reason.ShouldContain("پرداخت");
    }

    [Test]
    public void An_unpriced_request_is_not_payable()
    {
        var now = DateTimeOffset.UtcNow;

        GuesthousePaymentRules
            .Evaluate(GuesthouseRequestStatus.Submitted, null, now)
            .Payable.ShouldBeFalse();
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
dotnet test tests/Application.UnitTests/Application.UnitTests.csproj --filter GuesthousePaymentSummaryTests
```

Expected: FAIL — `GuesthousePaymentSummaryDto` does not exist.

- [ ] **Step 3: Write the payment module**

Create `src/Application/Walfare/Guesthouses/GuesthousePayments.cs`:

```csharp
using Mabhas19.Application.Common.Interfaces;
using Mabhas19.Application.Walfare.Payments;
using Mabhas19.Domain.Walfare;
using Microsoft.EntityFrameworkCore;
using ValidationException = Mabhas19.Application.Common.Exceptions.ValidationException;

namespace Mabhas19.Application.Walfare.Guesthouses;

file static class Fail
{
    public static ValidationException With(string property, string message) =>
        new([new FluentValidation.Results.ValidationFailure(property, message)]);
}

/// <summary>
/// What the payer is shown. Deliberately anonymous.
/// </summary>
/// <remarks>
/// No national code, no membership number, no names — not the applicant's and not the companions'.
/// The token travels in an SMS that can be forwarded to anybody, so this payload must be safe in a
/// stranger's hands. GuesthousePaymentSummaryTests fails if a field is added.
/// </remarks>
public sealed record GuesthousePaymentSummaryDto
{
    public string GuesthouseName { get; init; } = string.Empty;
    public string GuesthouseCity { get; init; } = string.Empty;
    public string CheckInDateJalali { get; init; } = string.Empty;
    public string CheckOutDateJalali { get; init; } = string.Empty;
    public int Nights { get; init; }
    public int GuestCount { get; init; }
    public long AmountRials { get; init; }
    public bool Payable { get; init; }

    /// <summary>Persian sentence when <see cref="Payable"/> is false. Empty otherwise.</summary>
    public string Reason { get; init; } = string.Empty;
}

public static class GuesthousePaymentRules
{
    public static (bool Payable, string Reason) Evaluate(
        GuesthouseRequestStatus status, DateTimeOffset? expiresUtc, DateTimeOffset now)
    {
        if (status == GuesthouseRequestStatus.Paid)
            return (false, "این درخواست قبلاً پرداخت شده است.");
        if (status is GuesthouseRequestStatus.Rejected or GuesthouseRequestStatus.Cancelled)
            return (false, "این درخواست دیگر معتبر نیست.");
        if (!GuesthouseTransitions.CanPay(status))
            return (false, "هنوز مبلغی برای این درخواست تعیین نشده است.");
        if (expiresUtc is null || expiresUtc <= now)
            return (false, "این لینک پرداخت منقضی شده است. لطفاً با امور رفاهی تماس بگیرید.");

        return (true, string.Empty);
    }
}

// ── anonymous: what am I paying for? ────────────────────────────────────────

/// <summary>Resolved by token alone — the payer may have no account, which is the whole point.</summary>
public record GetGuesthousePaymentSummaryQuery(string Token) : IRequest<GuesthousePaymentSummaryDto>;

public class GetGuesthousePaymentSummaryQueryHandler(IApplicationDbContext context, TimeProvider clock)
    : IRequestHandler<GetGuesthousePaymentSummaryQuery, GuesthousePaymentSummaryDto>
{
    public async Task<GuesthousePaymentSummaryDto> Handle(
        GetGuesthousePaymentSummaryQuery request, CancellationToken cancellationToken)
    {
        var entity = await context.GuesthouseRequests
            .AsNoTracking()
            .Include(r => r.Guesthouse)
            .Include(r => r.Companions)
            .FirstOrDefaultAsync(r => r.PaymentToken == request.Token, cancellationToken)
            ?? throw Fail.With("Token", "این لینک پرداخت معتبر نیست.");

        var (payable, reason) = GuesthousePaymentRules.Evaluate(
            entity.Status, entity.PaymentTokenExpiresUtc, clock.GetUtcNow());

        return new GuesthousePaymentSummaryDto
        {
            GuesthouseName = entity.Guesthouse?.Name ?? string.Empty,
            GuesthouseCity = entity.Guesthouse?.City ?? string.Empty,
            CheckInDateJalali = entity.CheckInDateJalali,
            CheckOutDateJalali = entity.CheckOutDateJalali,
            Nights = entity.Nights,
            GuestCount = entity.GuestCount,
            AmountRials = entity.AmountRials,
            Payable = payable,
            Reason = reason
        };
    }
}

// ── anonymous: start the payment ────────────────────────────────────────────

public record InitGuesthousePaymentCommand(string Token) : IRequest<PaymentRedirectDto>;

public class InitGuesthousePaymentCommandHandler(
    IApplicationDbContext context,
    IPaymentGateway gateway,
    TimeProvider clock) : IRequestHandler<InitGuesthousePaymentCommand, PaymentRedirectDto>
{
    public const string TargetType = "guesthouse-request";

    public async Task<PaymentRedirectDto> Handle(
        InitGuesthousePaymentCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.GuesthouseRequests
            .FirstOrDefaultAsync(r => r.PaymentToken == request.Token, cancellationToken)
            ?? throw Fail.With("Token", "این لینک پرداخت معتبر نیست.");

        var (payable, reason) = GuesthousePaymentRules.Evaluate(
            entity.Status, entity.PaymentTokenExpiresUtc, clock.GetUtcNow());
        if (!payable) throw Fail.With("Token", reason);

        // One ledger row per attempt, same as the pool flow: a fresh PaymentId per click keeps the
        // gateway's "duplicate request id" rule happy after an abandoned attempt.
        var tx = new PaymentTransaction
        {
            Gateway = PaymentGateway.IranKish,
            AmountRials = entity.AmountRials,
            PaymentId = string.Empty,
            Status = PaymentStatus.Initiated,
            TargetType = TargetType,
            TargetId = entity.Id,
            // Empty, not null: the payer may have no account. The request row already records who
            // the stay is for, and PayerName is a display field on the payments report.
            UserId = entity.UserId ?? string.Empty,
            PayerName = entity.FullName,
            PayerNationalCode = entity.NationalCode
        };
        context.PaymentTransactions.Add(tx);
        await context.SaveChangesAsync(cancellationToken);   // materialise tx.Id

        tx.PaymentId = tx.Id.ToString();
        var init = await gateway.InitAsync(tx.AmountRials, tx.PaymentId, cancellationToken);

        if (!init.Success || init.RedirectUrl is null)
        {
            tx.Status = PaymentStatus.Failed;
            tx.Description = init.Error;
            await context.SaveChangesAsync(cancellationToken);
            throw Fail.With("Token", init.Error ?? "اتصال به درگاه پرداخت ناموفق بود.");
        }

        tx.Token = init.Token;
        entity.PaymentTransactionId = tx.Id;
        await context.SaveChangesAsync(cancellationToken);

        return new PaymentRedirectDto(tx.Id, init.RedirectUrl);
    }
}
```

- [ ] **Step 4: Teach the shared completion step about the new target**

`src/Application/Walfare/Payments/Payments.cs` has a `PaymentCompletion` block whose method already branches on `tx.TargetType == InitPoolPaymentCommandHandler.TargetType`. Add this second branch beside it, in the same method:

```csharp
        if (tx.TargetType == InitGuesthousePaymentCommandHandler.TargetType)
        {
            var req = await context.GuesthouseRequests
                .FirstOrDefaultAsync(r => r.Id == tx.TargetId, cancellationToken);
            if (req is not null)
            {
                req.Status = GuesthouseRequestStatus.Paid;
                req.PaidAtUtc = tx.VerifiedAt ?? DateTimeOffset.UtcNow;
                req.PaymentTransactionId = tx.Id;

                // شماره فیش, pre-filled from the gateway and editable afterwards — some payments
                // still arrive as a bank transfer the admin enters by hand.
                if (string.IsNullOrWhiteSpace(req.ReceiptNumber))
                    req.ReceiptNumber = tx.RetrievalReferenceNumber ?? tx.PaymentId;

                // The link has done its job. Clearing it stops a forwarded SMS opening a live page.
                req.PaymentToken = null;
                req.PaymentTokenExpiresUtc = null;
            }
        }
```

Add `using Mabhas19.Application.Walfare.Guesthouses;` to the top of `Payments.cs`.

- [ ] **Step 5: Register the anonymous endpoints**

Append to `src/Web/Endpoints/Walfare/Walfare.cs`:

```csharp
/// <summary>
/// The SMS payment link. ANONYMOUS on purpose — the payer may have no account at all.
/// </summary>
/// <remarks>
/// Rate limited by the shared platform limiter. Note that limiter is 120/min for everyone behind a
/// single NAT, which is already a known concern elsewhere on this platform.
/// </remarks>
public class WalfareGuesthousePay : Mabhas19.Web.Infrastructure.IEndpointGroup
{
    public static string? RoutePrefix => "/api/walfare/guesthouse/pay";

    public static void Map(RouteGroupBuilder groupBuilder)
    {
        groupBuilder.MapGet(GetWalfareGuesthousePaySummary, "{token}").AllowAnonymous();
        groupBuilder.MapPost(InitWalfareGuesthousePayment, "{token}/init").AllowAnonymous();
    }

    public static async Task<Ok<GuesthousePaymentSummaryDto>> GetWalfareGuesthousePaySummary(
        ISender sender, string token)
        => TypedResults.Ok(await sender.Send(new GetGuesthousePaymentSummaryQuery(token)));

    public static async Task<Ok<PaymentRedirectDto>> InitWalfareGuesthousePayment(
        ISender sender, string token)
        => TypedResults.Ok(await sender.Send(new InitGuesthousePaymentCommand(token)));
}
```

- [ ] **Step 6: Run, build and commit**

```bash
dotnet test tests/Application.UnitTests/Application.UnitTests.csproj --filter GuesthousePaymentSummaryTests
dotnet build src/Web/Web.csproj
git add src/Application/Walfare src/Web/Endpoints/Walfare/Walfare.cs tests/Application.UnitTests/Walfare
git commit -m "feat(walfare): pay a guesthouse request by token, with an anonymous summary"
```

---

### Task 7: Sending the payment link by SMS

**Files:**
- Modify: `src/Application/Walfare/Guesthouses/GuesthouseAdmin.cs` (append)
- Modify: `src/Web/appsettings.json`
- Modify: `src/Web/Endpoints/Walfare/Walfare.cs`
- Test: `tests/Application.UnitTests/Walfare/GuesthouseSmsTextTests.cs`

**Interfaces:**
- Consumes: `ISmsSender` (Task 2); `GuesthouseTokens` (Task 5).
- Produces: `GuesthouseSmsText.Build(string guesthouseName, long amountRials, string url)`, `SendGuesthousePaymentSmsCommand(int Id)`.

- [ ] **Step 1: Write the failing message test**

Create `tests/Application.UnitTests/Walfare/GuesthouseSmsTextTests.cs`:

```csharp
using Shouldly;
using Mabhas19.Application.Walfare.Guesthouses;
using NUnit.Framework;

namespace Mabhas19.Application.UnitTests.Walfare;

public class GuesthouseSmsTextTests
{
    [Test]
    public void Message_names_the_guesthouse_the_amount_and_the_link()
    {
        var text = GuesthouseSmsText.Build(
            "مهمانسرای سنندج", 2_500_000, "https://refahi.kurdnezam.ir/pay/guesthouse/abc");

        text.ShouldContain("مهمانسرای سنندج");
        text.ShouldContain("https://refahi.kurdnezam.ir/pay/guesthouse/abc");
        text.ShouldContain("۲۵۰٬۰۰۰");   // rials rendered as tomans, grouped, Persian digits
    }

    [Test]
    public void Message_stays_short_enough_not_to_bill_as_several_parts()
    {
        var text = GuesthouseSmsText.Build("مهمانسرای سنندج", 2_500_000, "https://x.ir/p/abc");

        // Persian is two bytes per character in UTF-8 and long messages bill per part.
        text.Length.ShouldBeLessThan(200);
    }

    [Test]
    public void Message_carries_no_personal_detail()
    {
        var text = GuesthouseSmsText.Build("مهمانسرای سنندج", 2_500_000, "https://x.ir/p/abc");

        // Anyone can read an SMS over a shoulder; the page behind the link is already anonymous.
        text.ShouldNotContain("کد ملی");
        text.ShouldNotContain("عضویت");
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
dotnet test tests/Application.UnitTests/Application.UnitTests.csproj --filter GuesthouseSmsTextTests
```

Expected: FAIL — `GuesthouseSmsText` does not exist.

- [ ] **Step 3: Write the text builder and the send command**

Append to `src/Application/Walfare/Guesthouses/GuesthouseAdmin.cs`, and add `using Microsoft.Extensions.Configuration;` to its usings:

```csharp
public static class GuesthouseSmsText
{
    /// <summary>
    /// The message body. Short on purpose: Persian is two bytes per character in UTF-8 and a long
    /// message bills as several parts.
    /// </summary>
    /// <remarks>
    /// Carries no personal detail. Anyone can read an SMS over a shoulder, and the link behind it
    /// already shows only the stay and the amount.
    /// </remarks>
    public static string Build(string guesthouseName, long amountRials, string url)
    {
        var tomans = ToPersianDigits((amountRials / 10).ToString("#,##0"));
        return $"درخواست {guesthouseName} تأیید شد.\nمبلغ: {tomans} تومان\nپرداخت:\n{url}";
    }

    private static string ToPersianDigits(string value)
    {
        var sb = new System.Text.StringBuilder(value.Length);
        foreach (var ch in value)
        {
            if (ch is >= '0' and <= '9') sb.Append((char)('۰' + (ch - '0')));
            else if (ch == ',') sb.Append('٬');   // Persian thousands separator
            else sb.Append(ch);
        }
        return sb.ToString();
    }
}

/// <summary>
/// Sends — or re-sends — the payment link to the mobile already on the request.
/// </summary>
/// <remarks>
/// Re-sending re-uses the same token and only extends its life. A second live link for one request
/// is how somebody pays twice.
/// </remarks>
[Authorize(Roles = Roles.AdminOrSuper)]
public record SendGuesthousePaymentSmsCommand(int Id) : IRequest;

public class SendGuesthousePaymentSmsCommandHandler(
    IApplicationDbContext context,
    ISmsSender sms,
    TimeProvider clock,
    IConfiguration configuration) : IRequestHandler<SendGuesthousePaymentSmsCommand>
{
    public async Task Handle(SendGuesthousePaymentSmsCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.GuesthouseRequests
            .Include(r => r.Guesthouse)
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        if (entity.Status != GuesthouseRequestStatus.Priced)
            throw Fail.With(nameof(request.Id),
                "فقط برای درخواستی که مبلغ آن تعیین شده می‌توان لینک پرداخت فرستاد.");

        if (string.IsNullOrWhiteSpace(entity.Mobile))
            throw Fail.With("Mobile", "شماره همراهی برای این درخواست ثبت نشده است.");

        entity.PaymentToken ??= GuesthouseTokens.Mint();
        entity.PaymentTokenExpiresUtc = clock.GetUtcNow().Add(GuesthouseTokens.Lifetime);
        await context.SaveChangesAsync(cancellationToken);

        // The welfare front end's own origin, e.g. https://refahi.kurdnezam.ir
        var baseUrl = (configuration["Walfare:WebBaseUrl"] ?? string.Empty).TrimEnd('/');
        if (baseUrl.Length == 0)
            throw Fail.With("Configuration", "آدرس سامانه رفاهی تنظیم نشده است.");

        var url = $"{baseUrl}/pay/guesthouse/{entity.PaymentToken}";
        var text = GuesthouseSmsText.Build(entity.Guesthouse?.Name ?? "مهمانسرا", entity.AmountRials, url);

        var accepted = await sms.SendAsync(entity.Mobile, text, cancellationToken);

        // Reported, never assumed. A channel that fails silently tells the admin "sent" about a
        // message nobody received.
        if (!accepted)
            throw Fail.With("Sms", "ارسال پیامک ناموفق بود. لطفاً دوباره تلاش کنید.");
    }
}
```

- [ ] **Step 4: Add the configuration key**

In `src/Web/appsettings.json`, at the top level beside the other sections:

```json
  "Walfare": {
    "WebBaseUrl": "https://refahi.kurdnezam.ir"
  }
```

- [ ] **Step 5: Register the endpoint**

Add to the `WalfareGuesthouseRequests` group's `Map`:

```csharp
        groupBuilder.MapPost(SendWalfareGuesthousePaymentSms, "{id:int}/send-payment-sms").RequireAdmin();
```

and the handler to that class:

```csharp
    public static async Task<NoContent> SendWalfareGuesthousePaymentSms(ISender sender, int id)
    {
        await sender.Send(new SendGuesthousePaymentSmsCommand(id));
        return TypedResults.NoContent();
    }
```

- [ ] **Step 6: Run, build and commit**

```bash
dotnet test tests/Application.UnitTests/Application.UnitTests.csproj --filter GuesthouseSmsTextTests
dotnet build src/Web/Web.csproj
git add src/Application/Walfare src/Web tests/Application.UnitTests/Walfare
git commit -m "feat(walfare): send the guesthouse payment link by SMS"
```

---

### Task 8: The referral letter's data, and editing the receipt number

**Files:**
- Modify: `src/Application/Walfare/Guesthouses/GuesthouseAdmin.cs` (append)
- Modify: `src/Web/Endpoints/Walfare/Walfare.cs`
- Test: `tests/Application.UnitTests/Walfare/GuesthouseReferralTests.cs`

**Interfaces:**
- Consumes: `GuesthouseRequest`, `ApplicantGender`, `GuesthouseRequestStatus` (Task 1); `CompanionDto`, `CompanionRelationInput` (Task 4).
- Produces: `GuesthouseReferral.Title(ApplicantGender?)`, `GuesthouseReferralDto`, `GetGuesthouseReferralQuery(int Id)`, `UpdateGuesthouseReceiptCommand(int Id, string ReceiptNumber)`.

- [ ] **Step 1: Write the failing test**

Create `tests/Application.UnitTests/Walfare/GuesthouseReferralTests.cs`:

```csharp
using Shouldly;
using Mabhas19.Application.Walfare.Guesthouses;
using Mabhas19.Domain.Walfare;
using NUnit.Framework;

namespace Mabhas19.Application.UnitTests.Walfare;

public class GuesthouseReferralTests
{
    [Test]
    public void Title_is_the_Persian_honorific_for_the_gender()
    {
        GuesthouseReferral.Title(ApplicantGender.Male).ShouldBe("جناب آقای مهندس");
        GuesthouseReferral.Title(ApplicantGender.Female).ShouldBe("سرکار خانم مهندس");
    }

    /// <summary>
    /// The gender select is on the OFFICE's half of the paper form, so a member never fills it in.
    /// Guessing it from a first name is how a letter goes out addressed wrongly.
    /// </summary>
    [Test]
    public void Title_refuses_rather_than_guessing_when_gender_is_unset()
    {
        Should.Throw<InvalidOperationException>(() => GuesthouseReferral.Title(null));
    }
}
```

- [ ] **Step 2: Run it and watch it fail**

```bash
dotnet test tests/Application.UnitTests/Application.UnitTests.csproj --filter GuesthouseReferralTests
```

Expected: FAIL — `GuesthouseReferral` does not exist.

- [ ] **Step 3: Write the referral query and the receipt override**

Append to `src/Application/Walfare/Guesthouses/GuesthouseAdmin.cs`:

```csharp
public static class GuesthouseReferral
{
    /// <summary>«جناب آقای مهندس» / «سرکار خانم مهندس».</summary>
    /// <exception cref="InvalidOperationException">
    /// When gender is unset. Deliberate: a letter addressed with the wrong honorific is worse than
    /// a letter that has not printed yet, and a first name is not evidence.
    /// </exception>
    public static string Title(ApplicantGender? gender) => gender switch
    {
        ApplicantGender.Male => "جناب آقای مهندس",
        ApplicantGender.Female => "سرکار خانم مهندس",
        _ => throw new InvalidOperationException("gender is not set")
    };
}

/// <summary>Everything the printed معرفی‌نامه needs, and nothing else.</summary>
public sealed record GuesthouseReferralDto
{
    public int Id { get; init; }
    public string GuesthouseName { get; init; } = string.Empty;
    public string GuesthouseCity { get; init; } = string.Empty;
    public string ManagerName { get; init; } = string.Empty;

    /// <summary>Already rendered — «جناب آقای مهندس» or «سرکار خانم مهندس».</summary>
    public string ApplicantTitle { get; init; } = string.Empty;

    public string FullName { get; init; } = string.Empty;
    public string CheckInDateJalali { get; init; } = string.Empty;
    public string CheckOutDateJalali { get; init; } = string.Empty;
    public int Nights { get; init; }
    public int GuestCount { get; init; }
    public string ReceiptNumber { get; init; } = string.Empty;
    public CompanionDto[] Companions { get; init; } = [];
}

[Authorize(Roles = Roles.AdminOrSuper)]
public record GetGuesthouseReferralQuery(int Id) : IRequest<GuesthouseReferralDto>;

public class GetGuesthouseReferralQueryHandler(IApplicationDbContext context)
    : IRequestHandler<GetGuesthouseReferralQuery, GuesthouseReferralDto>
{
    public async Task<GuesthouseReferralDto> Handle(
        GetGuesthouseReferralQuery request, CancellationToken cancellationToken)
    {
        var entity = await context.GuesthouseRequests
            .AsNoTracking()
            .Include(r => r.Guesthouse)
            .Include(r => r.Companions)
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        // The letter cites شماره فیش, so it exists only once money has actually arrived.
        if (entity.Status != GuesthouseRequestStatus.Paid)
            throw Fail.With(nameof(request.Id), "معرفی‌نامه فقط پس از پرداخت صادر می‌شود.");

        if (entity.Gender is null)
            throw Fail.With("Gender", "برای صدور معرفی‌نامه، «جناب آقای / سرکار خانم» را مشخص کنید.");

        return new GuesthouseReferralDto
        {
            Id = entity.Id,
            GuesthouseName = entity.Guesthouse?.Name ?? string.Empty,
            GuesthouseCity = entity.Guesthouse?.City ?? string.Empty,
            ManagerName = entity.Guesthouse?.ManagerName ?? string.Empty,
            ApplicantTitle = GuesthouseReferral.Title(entity.Gender),
            FullName = entity.FullName,
            CheckInDateJalali = entity.CheckInDateJalali,
            CheckOutDateJalali = entity.CheckOutDateJalali,
            Nights = entity.Nights,
            GuestCount = entity.GuestCount,
            ReceiptNumber = entity.ReceiptNumber,
            Companions = entity.Companions
                .Select(c => new CompanionDto(
                    c.FullName,
                    c.Relation is null ? null : (CompanionRelationInput)(int)c.Relation,
                    c.IsInfant))
                .ToArray()
        };
    }
}

/// <summary>
/// Overrides شماره فیش by hand — for a payment that arrived as a bank transfer rather than through
/// the gateway.
/// </summary>
[Authorize(Roles = Roles.AdminOrSuper)]
public record UpdateGuesthouseReceiptCommand(int Id, string ReceiptNumber) : IRequest;

public class UpdateGuesthouseReceiptCommandHandler(IApplicationDbContext context)
    : IRequestHandler<UpdateGuesthouseReceiptCommand>
{
    public async Task Handle(UpdateGuesthouseReceiptCommand request, CancellationToken cancellationToken)
    {
        var entity = await context.GuesthouseRequests
            .FirstOrDefaultAsync(r => r.Id == request.Id, cancellationToken);
        Guard.Against.NotFound(request.Id, entity);

        if (string.IsNullOrWhiteSpace(request.ReceiptNumber))
            throw Fail.With(nameof(request.ReceiptNumber), "شماره فیش را وارد کنید.");

        entity.ReceiptNumber = request.ReceiptNumber.Trim();
        await context.SaveChangesAsync(cancellationToken);
    }
}
```

- [ ] **Step 4: Register the endpoints**

Add to the `WalfareGuesthouseRequests` group's `Map`:

```csharp
        groupBuilder.MapGet(GetWalfareGuesthouseReferral, "{id:int}/referral").RequireAdmin();
        groupBuilder.MapPut(UpdateWalfareGuesthouseReceipt, "{id:int}/receipt").RequireAdmin();
```

and these members to that class:

```csharp
    public record ReceiptBody(string ReceiptNumber);

    public static async Task<Ok<GuesthouseReferralDto>> GetWalfareGuesthouseReferral(ISender sender, int id)
        => TypedResults.Ok(await sender.Send(new GetGuesthouseReferralQuery(id)));

    public static async Task<NoContent> UpdateWalfareGuesthouseReceipt(
        ISender sender, int id, ReceiptBody body)
    {
        await sender.Send(new UpdateGuesthouseReceiptCommand(id, body.ReceiptNumber));
        return TypedResults.NoContent();
    }
```

- [ ] **Step 5: Run the whole suite, build and commit**

```bash
dotnet build src/Web/Web.csproj
dotnet test tests/Application.UnitTests/Application.UnitTests.csproj
dotnet test tests/Domain.UnitTests/Domain.UnitTests.csproj
git add src/Application/Walfare src/Web/Endpoints/Walfare/Walfare.cs tests/Application.UnitTests/Walfare
git commit -m "feat(walfare): referral letter data and a hand-editable receipt number"
```

---

### Task 9: Prove the whole flow over HTTP

No new code. This is the gate before the front end is worth writing.

- [ ] **Step 1: Apply the migration**

```bash
dotnet ef database update --project src/Infrastructure --startup-project src/Web
```

- [ ] **Step 2: Create a service and a guesthouse**

Create a `WelfareService` with `type: 2`, then:

```bash
curl -s -X POST "$API/api/walfare/guesthouses" -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' -d '{
    "serviceId": 1, "name": "مهمانسرای سنندج", "city": "سنندج",
    "managerName": "مسئول نمونه", "description": "", "isActive": true }'
```

Expected: `201` with the new id.

- [ ] **Step 3: Create a request for somebody NOT in KurdNezam**

This is the case the whole design turns on.

```bash
curl -s -X POST "$API/api/walfare/guesthouse-requests/admin" -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' -d '{
    "guesthouseId": 1, "fullName": "کاربر آزمایشی", "nationalCode": "0000000000",
    "membershipNumber": "0", "mobile": "09180000000",
    "checkInDate": "1405/06/01", "checkOutDate": "1405/06/03",
    "companions": [{"fullName":"همراه یک","relation":0,"isInfant":false},
                   {"fullName":"کودک یک","relation":null,"isInfant":true}] }'
```

Expected: `201`. **It must not require the national code to exist anywhere.**

- [ ] **Step 4: Price it and read the token back**

```bash
curl -s -X POST "$API/api/walfare/guesthouse-requests/1/price" -H "Authorization: Bearer $ADMIN" \
  -H 'Content-Type: application/json' -d '{"amountRials": 2500000, "adminNote": "", "gender": 0}'

curl -s "$API/api/walfare/guesthouse-requests/admin/list?status=1" -H "Authorization: Bearer $ADMIN"
```

Expected: `204`, then a row with `status: 1`, `nights: 2`, `guestCount: 2`, and a non-null `paymentToken`.

- [ ] **Step 5: Open the payment summary with NO credentials at all**

```bash
curl -s "$API/api/walfare/guesthouse/pay/$TOKEN"
```

Expected: `200`, `payable: true`. Then **read the whole body** and confirm it contains no `nationalCode`, no `fullName`, no `membershipNumber` and no companion names. Do not assume — this is the privacy claim the design rests on.

- [ ] **Step 6: Confirm an expired link refuses**

Set `PaymentTokenExpiresUtc` to a past instant directly in the database, then repeat step 5.

Expected: `200` with `payable: false` and a Persian `reason` containing «منقضی». The init call must refuse too:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$API/api/walfare/guesthouse/pay/$TOKEN/init"
```

Expected: `400`.

- [ ] **Step 7: Record what was and was not proven**

Write `docs/worklog/2026-08-19-walfare-guesthouse-backend.md` from `docs/worklog/TEMPLATE.md`, add its line to `docs/worklog/README.md`, and state plainly which steps were exercised against the real Iran Kish gateway and which were not. A real card payment almost certainly was not — say so rather than implying it.

```bash
git add docs/worklog
git commit -m "docs(walfare): work record for the guesthouse backend"
```

---

## Self-review

**Spec coverage.** Every section maps to a task: domain and the one-companion-table decision → 1; SMS → 2 and 7; guesthouse CRUD → 3; member and admin submission including the not-in-KurdNezam path → 4; lifecycle, pricing and token minting → 5; the two payment doors and the privacy rule → 6; referral letter and editable receipt → 8; end-to-end proof → 9. The front end is explicitly a separate plan.

**Placeholders.** None. Every code step carries its code; every command carries its expected output.

**Type consistency.** `GuesthouseRequestDto`, `CompanionDto`, `CompanionRelationInput` and `GuesthouseProjection.ToDto` are defined once in Task 4 and consumed by Tasks 5 and 8. `GuesthouseTransitions.CanPay` is defined in Task 5 and consumed in Task 6. `GuesthouseTokens.Mint`/`Lifetime` are defined in Task 5 and consumed in Tasks 5 and 7. `InitGuesthousePaymentCommandHandler.TargetType` is defined in Task 6 and consumed by the Task 6 edit to `Payments.cs`. `ISmsSender.SendAsync` is defined in Task 2 and consumed in Task 7. `GuesthouseRequestInputValidator.Digits` is defined in Task 4 and consumed by `GuesthouseRequestFactory` in the same task.

**One gap found while reviewing, and closed deliberately:** the spec's lifecycle lets the member cancel, and `GuesthouseTransitions.CanCancel` exists and is written here, but no task exposes a cancel endpoint. That is intentional — the member's cancel button belongs with the member UI, so the endpoint ships in the front-end plan alongside the thing that calls it. The guard is written and tested here so it needs no revisiting then.
