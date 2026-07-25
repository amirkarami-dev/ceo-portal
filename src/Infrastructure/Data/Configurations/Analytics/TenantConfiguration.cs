using Mabhas19.Domain.Analytics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Mabhas19.Infrastructure.Data.Configurations.Analytics;

public class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("AnalyticsTenants");

        builder.Property(t => t.Slug).HasMaxLength(100).IsRequired();
        builder.Property(t => t.Name).HasMaxLength(300).IsRequired();
        builder.Property(t => t.Plan).HasMaxLength(50).IsRequired();
        builder.Property(t => t.Status).HasMaxLength(50).IsRequired();
        builder.Property(t => t.BrandingJson).HasColumnType("nvarchar(max)").IsRequired();

        builder.HasIndex(t => t.Slug).IsUnique();
    }
}
