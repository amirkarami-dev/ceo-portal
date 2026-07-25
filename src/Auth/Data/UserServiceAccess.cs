using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Mabhas19.Auth.Data;

/// <summary>
/// A single grant: user <see cref="UserId"/> may use the product service <see cref="ServiceKey"/>.
/// A user with no rows here is grandfathered (all services allowed); any rows restrict them to
/// exactly those services.
/// </summary>
public class UserServiceAccess
{
    public int Id { get; set; }

    /// <summary>FK to AspNetUsers(Id) — the owning <see cref="AuthUser"/>.</summary>
    public string UserId { get; set; } = default!;

    /// <summary>A key from <see cref="ServiceKeys"/> (e.g. "mabhas19", "analytics").</summary>
    public string ServiceKey { get; set; } = default!;

    public DateTimeOffset GrantedAtUtc { get; set; }

    /// <summary>User name (or subject) of the administrator who last set this grant; null if unknown.</summary>
    public string? GrantedBy { get; set; }
}

public class UserServiceAccessConfiguration : IEntityTypeConfiguration<UserServiceAccess>
{
    public void Configure(EntityTypeBuilder<UserServiceAccess> builder)
    {
        builder.ToTable("UserServiceAccess");

        builder.HasKey(x => x.Id);

        builder.Property(x => x.UserId)
            .IsRequired()
            .HasMaxLength(450);   // matches AspNetUsers.Id (nvarchar(450))

        builder.Property(x => x.ServiceKey)
            .IsRequired()
            .HasMaxLength(64);

        builder.Property(x => x.GrantedBy)
            .HasMaxLength(450);

        // One row per (user, service) — replacing grants is an idempotent set operation.
        builder.HasIndex(x => new { x.UserId, x.ServiceKey })
            .IsUnique();

        // Cascade so deleting a user removes their grants.
        builder.HasOne<AuthUser>()
            .WithMany()
            .HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
