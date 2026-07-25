using Mabhas19.Domain.Analytics;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Mabhas19.Infrastructure.Data.Configurations.Analytics;

public class DashboardConfiguration : IEntityTypeConfiguration<Dashboard>
{
    public void Configure(EntityTypeBuilder<Dashboard> builder)
    {
        builder.ToTable("AnalyticsDashboards");

        builder.Property(d => d.TenantId).HasMaxLength(100).IsRequired();
        builder.Property(d => d.Name).HasMaxLength(300).IsRequired();
        builder.Property(d => d.WidgetsJson).HasColumnType("nvarchar(max)").IsRequired();
        builder.Property(d => d.LayoutJson).HasColumnType("nvarchar(max)").IsRequired();
        builder.Property(d => d.OwnerName).HasMaxLength(256);

        builder.HasIndex(d => d.TenantId);
    }
}
