// Sample Domain entity — copy to src/Domain/Entities/<Entity>.cs and replace placeholders.
//
// Replace:
//   <RootName>  — the .NET namespace root (e.g. MyApp); matches <PROJECT_NAME>
//   <Entity>    — the entity name (e.g. Project)
//   <Owner>     — the owning aggregate/foreign entity if any (e.g. Assessment)
//
// Conventions:
//   - Entities inherit BaseAuditableEntity (Id + Created/CreatedBy/LastModified/LastModifiedBy).
//   - Use `required` for mandatory fields so the compiler enforces them at construction.
//   - Column types / indexes / relationships go in an IEntityTypeConfiguration<T> under
//     Infrastructure/Data/Configurations — NOT here. Keep entities persistence-ignorant.
//   - A computed property that delegates to a Domain service is fine (it's pure domain logic).
namespace <RootName>.Domain.Entities;

/// <summary>One-line description of what this entity represents in the domain.</summary>
public class <Entity> : BaseAuditableEntity
{
    /// <summary>Required display title.</summary>
    public required string Title { get; set; }

    /// <summary>Optional free-text field.</summary>
    public string? Description { get; set; }

    public double SomeNumber { get; set; }

    public int SomeCount { get; set; }

    /// <summary>Owning ASP.NET Identity user id (set from IUser.Id in the command handler).</summary>
    public required string OwnerId { get; set; }

    /// <summary>Optional 1:1 child aggregate.</summary>
    public <Owner>? <Owner> { get; set; }

    // Example of a pure-domain computed property delegating to a Domain service.
    // (Domain services hold any numerically-sensitive logic that is unit-tested for parity.)
    // public SomeResult Computed => SomeDomainCalculator.Calculate(SomeNumber, SomeCount);
}
